
import { Home, LogOut, MessageSquare, Settings, Shield } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import Messenger from './components/Messenger';
import SettingsPanel from './components/SettingsPanel';
import { auth, db, doc, getDoc, onValue, ref, rtdb, setDoc } from './services/firebase';
import { AlertLog, AppSettings, AppView, ChatMessage, EmergencyContact, User } from './types';

const SETTINGS_KEY = 'guardian_link_v4';
const ACTIVE_ALERT_KEY = 'guardian_active_alert_id_v3';

const DEFAULT_SETTINGS: AppSettings = {
  triggerPhrase: 'Guardian, help me',
  checkInDuration: 15,
  contacts: [],
  isListening: false,
  onboarded: false
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('guardian_user');
      const isAuth = localStorage.getItem('isAuthenticated');
      // Require both user object and auth flag
      return (saved && isAuth === 'true') ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  
  const [appView, setAppView] = useState<AppView>(AppView.DASHBOARD);
  
  // Persistence Fix: Ensure robust read from localStorage on mount
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure contacts is always an array
        return { ...DEFAULT_SETTINGS, ...parsed, contacts: parsed.contacts || [] };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [activeAlertId, setActiveAlertId] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_ALERT_KEY);
  });
  const [isEmergency, setIsEmergency] = useState(!!activeAlertId);
  const wakeLockRef = useRef<any>(null);

  // Sync settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Background Execution Fix: Robust Screen Wake Lock implementation
  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && settings.isListening) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (err) {
          console.error("Wake Lock failed:", err);
        }
      } else if (!settings.isListening && wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        } catch (err) {
          console.error("Wake Lock release failed:", err);
        }
      }
    };

    // Initial request
    requestWakeLock();

    // Re-acquire lock if tab visibility changes (browser often releases lock on hide)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && settings.isListening) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, [settings.isListening]);

  // Cloud Sync: Merge cloud data with local data carefully
  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      try {
        const userEmail = user.email.toLowerCase();
        const docRef = doc(db, "settings", userEmail);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const cloudData = docSnap.data() as AppSettings;
          setSettings(prev => ({
            ...prev,
            ...cloudData,
            // Prioritize local contacts if cloud is empty but local isn't (optional safety)
            // But generally cloud is truth. Here we ensure array structure.
            contacts: Array.isArray(cloudData.contacts) ? cloudData.contacts : []
          }));
        } else {
          // If no cloud settings, push current local settings to cloud
          await setDoc(docRef, settings);
        }

        // Also ensure user profile exists in Firestore for discovery
        const userRef = doc(db, "users", userEmail);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
           await setDoc(userRef, {
             name: user.name,
             email: user.email
           });
        }
      } catch (e) {
        console.error("Cloud sync failed", e);
      }
    };
    fetchSettings();
  }, [user?.email]);

  useEffect(() => {
    if (!user || !settings.contacts || settings.contacts.length === 0) return;
    let alertActive = false;
    let timerId: any = null;

    const playAlert = () => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance("HELP HELP, EMERGENCY ALERT");
      utterance.onend = () => { if (alertActive) timerId = setTimeout(playAlert, 1500); };
      window.speechSynthesis.speak(utterance);
    };

    const stopAlert = () => {
      alertActive = false;
      if (timerId) clearTimeout(timerId);
      window.speechSynthesis.cancel();
    };

    const sanitize = (e: string) => e.replace(/[\.\#\$\/\[\]]/g, '_');
    const unsubscribers = settings.contacts.map((contact: EmergencyContact) => {
      const sorted = [user.email.toLowerCase(), contact.email.toLowerCase()].sort();
      const combinedId = `${sanitize(sorted[0])}__${sanitize(sorted[1])}`;
      return onValue(ref(rtdb, `direct_chats/${combinedId}/updates`), (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const msgs = Object.values(data) as ChatMessage[];
          if (msgs.length > 0) {
            const latest = msgs.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
            const isFromOther = latest.senderEmail.toLowerCase() !== user.email.toLowerCase();
            const isSOS = latest.type === 'location' || /\b(sos|help|emergency|location|pinpoint)\b/i.test(latest.text);
            if (isFromOther && isSOS && (Date.now() - latest.timestamp < 120000)) {
              if (!alertActive) { alertActive = true; playAlert(); }
            }
          }
        }
      });
    });

    const handleInteraction = () => stopAlert();
    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    return () => {
      unsubscribers.forEach((u: () => void) => u());
      stopAlert();
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, [user?.email, settings.contacts]);

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    // Explicitly write to local storage immediately to prevent race conditions on reload
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    if (user) await setDoc(doc(db, "settings", user.email.toLowerCase()), updated, { merge: true });
  };

  const handleUserUpdate = async (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('guardian_user', JSON.stringify(updatedUser));
    // Sync to Firestore 'users' collection for discovery by others
    try {
      await setDoc(doc(db, "users", updatedUser.email.toLowerCase()), {
        name: updatedUser.name,
        email: updatedUser.email
      }, { merge: true });
    } catch (e) {
      console.error("Failed to sync user profile", e);
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
    localStorage.clear();
    localStorage.removeItem('isAuthenticated');
    setUser(null);
    setSettings(DEFAULT_SETTINGS);
    setAppView(AppView.DASHBOARD);
  };

  if (!user) {
    return (
      <AuthScreen 
        onLogin={(u: User) => { 
          setUser(u); 
          localStorage.setItem('guardian_user', JSON.stringify(u)); 
          localStorage.setItem('isAuthenticated', 'true');
        }} 
      />
    );
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
          <LogOut size={18} />
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
              onAlert={(log: AlertLog) => setActiveAlertId(log.id)} 
              externalActiveAlertId={activeAlertId} 
              onClearAlert={() => setActiveAlertId(null)}
            />
          </div>
        )}
        {appView === AppView.MESSENGER && <Messenger user={user} settings={settings} activeAlertId={activeAlertId} />}
        {appView === AppView.SETTINGS && (
          <div className="p-6 pb-28">
            <SettingsPanel 
              user={user} 
              onUpdateUser={handleUserUpdate}
              settings={settings} 
              updateSettings={updateSettings} 
            />
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-6 bg-gradient-to-t from-[#020617] to-transparent z-40">
        <div className="flex justify-around items-center glass p-2 rounded-[2.5rem] border border-white/10 shadow-2xl">
          {[
            { id: AppView.DASHBOARD, icon: Home, label: 'Safety' },
            { id: AppView.MESSENGER, icon: MessageSquare, label: 'Chats' },
            { id: AppView.SETTINGS, icon: Settings, label: 'Settings' }
          ].map((item) => (
            <button 
              key={item.id} 
              onClick={() => setAppView(item.id)} 
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl transition-all ${appView === item.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
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
