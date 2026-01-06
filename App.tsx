
import { Home, LogOut, MessageSquare, Settings, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import Messenger from './components/Messenger';
import SettingsPanel from './components/SettingsPanel';
import { auth, db, doc, getDoc, onValue, ref, rtdb, setDoc } from './services/firebase';
import { AppSettings, AppView, ChatMessage, User } from './types';

const SETTINGS_KEY = 'guardian_link_settings_v3';
const ACTIVE_ALERT_KEY = 'guardian_active_alert_id_v3';

const DEFAULT_SETTINGS: AppSettings = {
  triggerPhrase: 'Guardian, help me',
  checkInDuration: 15,
  contacts: [],
  isListening: false
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('guardian_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  
  const [appView, setAppView] = useState<AppView>(AppView.DASHBOARD);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeAlertId, setActiveAlertId] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_ALERT_KEY);
  });
  const [isEmergency, setIsEmergency] = useState(!!activeAlertId);

  // Sync settings when user logs in
  useEffect(() => {
    if (!user) return;

    const fetchSettings = async () => {
      try {
        const userEmail = user.email.toLowerCase();
        const docRef = doc(db, "settings", userEmail);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const cloudData = docSnap.data() as AppSettings;
          // Ensure contacts is always initialized as an array
          const cloudSettings = {
            ...DEFAULT_SETTINGS,
            ...cloudData,
            contacts: Array.isArray(cloudData.contacts) ? cloudData.contacts : []
          };
          
          setSettings(cloudSettings);
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(cloudSettings));
        } else {
          // If user exists but has no cloud settings (first login), 
          // check local storage fallback or use defaults
          const local = localStorage.getItem(SETTINGS_KEY);
          if (local) {
             const localData = JSON.parse(local);
             await setDoc(docRef, localData);
             setSettings(localData);
          } else {
             await setDoc(docRef, DEFAULT_SETTINGS);
             setSettings(DEFAULT_SETTINGS);
          }
        }
      } catch (e) {
        console.error("Cloud sync failed, using local fallback", e);
        const local = localStorage.getItem(SETTINGS_KEY);
        if (local) setSettings(JSON.parse(local));
      }
    };

    fetchSettings();
  }, [user?.email]);

  // DETECTOR FOR GUARDIAN ALERTS (Receiver Audio Logic)
  useEffect(() => {
    if (!user || !settings.contacts || settings.contacts.length === 0) return;

    let alertActive = false;
    let timerId: any = null;

    const playAlert = () => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance("HELP HELP, EMERGENCY ALERT");
      utterance.volume = 1; // Max volume for the utterance
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      utterance.onend = () => {
        if (alertActive) {
          timerId = setTimeout(playAlert, 1500);
        }
      };
      window.speechSynthesis.speak(utterance);
    };

    const stopAlert = () => {
      alertActive = false;
      if (timerId) clearTimeout(timerId);
      window.speechSynthesis.cancel();
    };

    const sanitize = (e: string) => e.replace(/[\.\#\$\/\[\]]/g, '_');
    
    // Subscribe to all authorized mesh nodes for incoming SOS signals
    const unsubscribers = settings.contacts.map(contact => {
      const email1 = user.email.toLowerCase().trim();
      const email2 = contact.email.toLowerCase().trim();
      const sorted = [email1, email2].sort();
      const combinedId = `${sanitize(sorted[0])}__${sanitize(sorted[1])}`;
      const path = `direct_chats/${combinedId}/updates`;
      
      return onValue(ref(rtdb, path), (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const msgs = Object.values(data) as ChatMessage[];
          if (msgs.length > 0) {
            // Get the most recent message in the thread
            const latest = msgs.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
            const isFromOther = latest.senderEmail.toLowerCase().trim() !== user.email.toLowerCase().trim();
            const isSOS = latest.type === 'location' || 
                          /\b(sos|help|emergency|location|pinpoint)\b/i.test(latest.text);
            
            // Only trigger if message is fresh (last 2 minutes) to prevent legacy alerts firing
            if (isFromOther && isSOS && (Date.now() - latest.timestamp < 120000)) {
              if (!alertActive) {
                alertActive = true;
                playAlert();
              }
            }
          }
        }
      });
    });

    // Interaction stops the alert (counts as "opening" or "checking")
    const handleInteraction = () => stopAlert();
    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);

    return () => {
      unsubscribers.forEach(u => u());
      stopAlert();
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, [user?.email, settings.contacts]);

  // Persist settings locally and to cloud whenever they change
  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));

    if (user) {
      try {
        const userEmail = user.email.toLowerCase();
        await setDoc(doc(db, "settings", userEmail), updated, { merge: true });
      } catch (e) {
        console.error("Failed to save settings to cloud", e);
      }
    }
  };

  useEffect(() => {
    if (activeAlertId) {
      localStorage.setItem(ACTIVE_ALERT_KEY, activeAlertId);
      setIsEmergency(true);
    } else {
      localStorage.removeItem(ACTIVE_ALERT_KEY);
      setIsEmergency(false);
    }
  }, [activeAlertId]);

  const handleLogout = () => {
    auth.signOut().catch(() => {});
    localStorage.removeItem('guardian_user');
    localStorage.removeItem(ACTIVE_ALERT_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    setUser(null);
    setSettings(DEFAULT_SETTINGS);
    setAppView(AppView.DASHBOARD);
  };

  if (!user) {
    return <AuthScreen onLogin={(u) => { 
      setUser(u); 
      localStorage.setItem('guardian_user', JSON.stringify(u)); 
    }} />;
  }

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-[#020617] relative text-slate-100 font-sans shadow-2xl">
      <header className="p-6 bg-[#020617]/90 backdrop-blur-xl sticky top-0 z-50 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl transition-all duration-500 ${isEmergency ? 'bg-red-600 shadow-[0_0_30px_rgba(239,68,68,0.6)]' : 'bg-blue-600'}`}>
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight leading-none uppercase text-white">GuardianLink</h1>
            <p className={`text-[8px] mono uppercase font-bold tracking-[0.3em] mt-1 ${isEmergency ? 'text-red-500 animate-pulse' : 'text-slate-500'}`}>
              {isEmergency ? 'CRITICAL ALERT ACTIVE' : 'Aegis Protection'}
            </p>
          </div>
        </div>
        <button onClick={handleLogout} className="p-2 text-slate-600 hover:text-red-500 transition-colors group">
          <LogOut size={18} className="group-hover:scale-110 transition-transform" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {appView === AppView.DASHBOARD && (
          <div className="p-6 pb-28">
            <Dashboard 
              user={user} 
              settings={settings} 
              updateSettings={updateSettings}
              isEmergency={isEmergency}
              onAlert={(log) => setActiveAlertId(log.id)}
              externalActiveAlertId={activeAlertId}
              onClearAlert={() => setActiveAlertId(null)}
            />
          </div>
        )}
        {appView === AppView.MESSENGER && (
          <Messenger user={user} settings={settings} activeAlertId={activeAlertId} />
        )}
        {appView === AppView.SETTINGS && (
          <div className="p-6 pb-28">
            <SettingsPanel settings={settings} updateSettings={updateSettings} />
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-6 bg-gradient-to-t from-[#020617] via-[#020617] to-transparent z-40">
        <div className="flex justify-around items-center glass p-2 rounded-[2.5rem] border border-white/10 shadow-2xl">
          {[
            { id: AppView.DASHBOARD, icon: Home, label: 'Safety' },
            { id: AppView.MESSENGER, icon: MessageSquare, label: 'Chats' },
            { id: AppView.SETTINGS, icon: Settings, label: 'Settings' }
          ].map(item => (
            <button 
              key={item.id} 
              onClick={() => setAppView(item.id)} 
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl transition-all duration-300 ${appView === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <item.icon size={18} />
              {appView === item.id && <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default App;
