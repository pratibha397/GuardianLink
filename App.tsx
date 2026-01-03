
import { Activity, Home, LogOut, Radio, Settings, Shield } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import AlertHistory from './components/AlertHistory';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import SettingsPanel from './components/SettingsPanel';
import { AlertLog, AppSettings, AppView, User } from './types';

const STORAGE_KEY = 'guardian_voice_settings';
const LOGS_KEY = 'guardian_voice_logs';
const AUTH_KEY = 'guardian_voice_user';
const GLOBAL_ALERTS_KEY = 'guardian_voice_global_alerts';

const DEFAULT_SETTINGS: AppSettings = {
  triggerPhrase: 'I am in danger',
  messageTemplate: 'URGENT: I need assistance. Tracking location: {location}',
  contacts: [],
  isListening: false
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [incomingAlert, setIncomingAlert] = useState<AlertLog | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem(AUTH_KEY);
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) { console.error("User parse error", e); }
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings((prev: AppSettings) => ({ ...prev, ...parsed, isListening: false }));
      } catch (e) { console.error("Settings parse error", e); }
    }
    
    const savedLogs = localStorage.getItem(LOGS_KEY);
    if (savedLogs) {
      try {
        setLogs(JSON.parse(savedLogs));
      } catch (e) { console.error("Logs parse error", e); }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const checkIncoming = () => {
      const allAlerts: AlertLog[] = JSON.parse(localStorage.getItem(GLOBAL_ALERTS_KEY) || '[]');
      // Filter alerts where current user is a listed recipient OR just show any for demo feed
      const alertForMe = allAlerts.find((a: AlertLog) => 
        a.recipients.some((r: string) => r.includes(user.phone)) && a.senderPhone !== user.phone && a.isLive
      );
      if (alertForMe) setIncomingAlert(alertForMe);
      else setIncomingAlert(null);
    };

    const interval = setInterval(checkIncoming, 3000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, isListening: false }));
  }, [settings, user]);

  useEffect(() => {
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  }, [logs]);

  const handleLogout = (): void => {
    localStorage.removeItem(AUTH_KEY);
    setUser(null);
  };

  const updateSettings = (newSettings: Partial<AppSettings>): void => {
    setSettings((prev: AppSettings) => ({ ...prev, ...newSettings }));
  };

  const addLog = (log: AlertLog): void => {
    setLogs((prev: AlertLog[]) => [log, ...prev]);
    setIsEmergencyActive(true);
    const currentGlobal = JSON.parse(localStorage.getItem(GLOBAL_ALERTS_KEY) || '[]');
    localStorage.setItem(GLOBAL_ALERTS_KEY, JSON.stringify([log, ...currentGlobal]));
    
    setTimeout(() => setIsEmergencyActive(false), 60000); // Alert stays live for 1 min
  };

  if (!user) {
    return (
      <AuthScreen 
        onLogin={(u: User) => { 
          setUser(u); 
          localStorage.setItem(AUTH_KEY, JSON.stringify(u)); 
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-slate-950 shadow-2xl overflow-hidden relative border-x border-slate-900 text-slate-100">
      <header className="p-6 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/50 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-[1rem] transition-all duration-500 ${isEmergencyActive ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.5)]' : 'bg-slate-800 text-slate-400'}`}>
            <Shield size={24} className={isEmergencyActive ? 'animate-pulse' : ''} />
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tighter italic">Guardian Link</h1>
            <p className="text-[9px] text-blue-500 font-black uppercase tracking-widest">{user.name}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="p-2 text-slate-600 hover:text-red-500 transition-colors">
          <LogOut size={18} />
        </button>
      </header>

      {incomingAlert && (
        <div className="mx-4 mt-4 p-4 bg-blue-600 rounded-[1.8rem] flex items-center justify-between animate-in slide-in-from-top-full duration-500 shadow-xl shadow-blue-950/50 border border-blue-400/30">
          <div className="flex items-center gap-3">
            <Radio className="text-white animate-pulse" size={20} />
            <div>
              <p className="text-[10px] font-black text-blue-100 uppercase tracking-widest">Incoming Broadcast</p>
              <p className="text-sm text-white font-bold">{incomingAlert.senderName}</p>
            </div>
          </div>
          <button 
            onClick={() => setView(AppView.GUARDIAN_LINK)}
            className="bg-white text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform"
          >
            Open App
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-6 pb-28">
        {view === AppView.DASHBOARD && (
          <Dashboard 
            user={user}
            settings={settings} 
            updateSettings={updateSettings} 
            onAlertTriggered={addLog}
            isEmergency={isEmergencyActive}
          />
        )}
        {view === AppView.SETTINGS && (
          <SettingsPanel settings={settings} updateSettings={updateSettings} />
        )}
        {view === AppView.GUARDIAN_LINK && (
          <AlertHistory logs={logs} clearLogs={() => setLogs([])} />
        )}
      </main>

      <nav className="absolute bottom-0 left-0 right-0 p-5 bg-slate-950/90 backdrop-blur-xl border-t border-slate-900 z-40">
        <div className="flex justify-around items-center bg-slate-900/50 p-1.5 rounded-[2rem] border border-slate-800/50">
          {[
            { id: AppView.DASHBOARD, icon: Home, label: 'Safety' },
            { id: AppView.GUARDIAN_LINK, icon: Activity, label: 'Link Feed' },
            { id: AppView.SETTINGS, icon: Settings, label: 'Setup' }
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-2xl transition-all duration-300 ${view === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 scale-105' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <item.icon size={20} />
              <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default App;
