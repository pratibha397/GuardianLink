
import { Activity, Home, LogOut, Settings, Shield } from 'lucide-react';
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
  triggerPhrase: 'Help help',
  messageTemplate: 'EMERGENCY! I need help. My live location: {location}',
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
    
    setTimeout(() => setIsEmergencyActive(false), 30000);
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
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-slate-900 shadow-2xl overflow-hidden relative border-x border-slate-800 text-slate-100">
      <header className="p-6 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex justify-between items-center sticky top-0 z-30 text-white">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isEmergencyActive ? 'bg-red-500 text-white emergency-pulse' : 'bg-blue-600 text-white'}`}>
            <Shield size={24} />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight">GuardianVoice</h1>
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">Session: {user.name}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-400 transition-colors">
          <LogOut size={18} />
        </button>
      </header>

      {incomingAlert && (
        <div className="mx-4 mt-4 p-4 bg-red-600 rounded-2xl flex items-center justify-between animate-bounce shadow-lg shadow-red-900/40">
          <div className="flex items-center gap-3">
            <Activity className="text-white animate-pulse" />
            <div>
              <p className="text-xs font-black text-white uppercase">Incoming Emergency!</p>
              <p className="text-sm text-red-100 font-medium">From: {incomingAlert.senderPhone}</p>
            </div>
          </div>
          <button 
            onClick={() => setView(AppView.ALERT_HISTORY)}
            className="bg-white text-red-600 px-3 py-1 rounded-full text-xs font-bold"
          >
            Track Live
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-6 pb-24">
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
        {view === AppView.ALERT_HISTORY && (
          <AlertHistory logs={logs} clearLogs={() => setLogs([])} />
        )}
      </main>

      <nav className="absolute bottom-0 left-0 right-0 p-4 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 z-20">
        <div className="flex justify-around items-center">
          {[
            { id: AppView.DASHBOARD, icon: Home, label: 'Monitor' },
            { id: AppView.ALERT_HISTORY, icon: Activity, label: 'Logs' },
            { id: AppView.SETTINGS, icon: Settings, label: 'Setup' }
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center gap-1 transition-colors ${view === item.id ? 'text-blue-500' : 'text-slate-500'}`}
            >
              <item.icon size={22} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default App;
