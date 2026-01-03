
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
      try { setUser(JSON.parse(savedUser)); } catch (e) {}
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings((prev) => ({ ...prev, ...parsed, isListening: false }));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const checkIncoming = () => {
      const all: AlertLog[] = JSON.parse(localStorage.getItem(GLOBAL_ALERTS_KEY) || '[]');
      const alertForMe = all.find(a => a.recipients.includes(user.phone) && a.senderPhone !== user.phone && a.isLive);
      if (alertForMe) setIncomingAlert(alertForMe);
      else setIncomingAlert(null);
    };
    const interval = setInterval(checkIncoming, 3000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, isListening: false }));
  }, [settings, user]);

  const handleLogout = () => { localStorage.removeItem(AUTH_KEY); setUser(null); };

  const addLog = (log: AlertLog) => {
    setIsEmergencyActive(true);
    const current = JSON.parse(localStorage.getItem(GLOBAL_ALERTS_KEY) || '[]');
    localStorage.setItem(GLOBAL_ALERTS_KEY, JSON.stringify([log, ...current]));
    setTimeout(() => setIsEmergencyActive(false), 300000); // Live for 5 mins
  };

  if (!user) return <AuthScreen onLogin={(u) => { setUser(u); localStorage.setItem(AUTH_KEY, JSON.stringify(u)); }} />;

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-slate-950 shadow-2xl relative border-x border-slate-900 text-slate-100 font-sans">
      <header className="p-6 bg-slate-950/80 backdrop-blur-md border-b border-slate-900 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isEmergencyActive ? 'bg-blue-600 animate-pulse' : 'bg-slate-900'}`}><Shield size={24} /></div>
          <div>
            <h1 className="font-black text-xl italic tracking-tighter">Guardian Link</h1>
            <p className="text-[9px] text-blue-500 font-black uppercase tracking-widest">{user.name}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="p-2 text-slate-700 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
      </header>

      {incomingAlert && (
        <div className="mx-6 mt-4 p-4 bg-blue-600 rounded-[2rem] flex items-center justify-between shadow-2xl border border-blue-400/30 animate-bounce">
          <div className="flex items-center gap-3">
            <Radio className="text-white animate-pulse" size={20} />
            <p className="text-xs text-white font-black">{incomingAlert.senderName} IN DANGER</p>
          </div>
          <button onClick={() => setView(AppView.GUARDIAN_LINK)} className="bg-white text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase">Open Link</button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-6 pb-28">
        {view === AppView.DASHBOARD && <Dashboard user={user} settings={settings} updateSettings={(s) => setSettings(p => ({...p, ...s}))} onAlertTriggered={addLog} isEmergency={isEmergencyActive} />}
        {view === AppView.SETTINGS && <SettingsPanel settings={settings} updateSettings={(s) => setSettings(p => ({...p, ...s}))} />}
        {view === AppView.GUARDIAN_LINK && <AlertHistory logs={logs} clearLogs={() => {}} user={user} />}
      </main>

      <nav className="absolute bottom-0 left-0 right-0 p-5 bg-slate-950/90 backdrop-blur-xl border-t border-slate-900 z-40">
        <div className="flex justify-around items-center bg-slate-900/50 p-2 rounded-[2rem] border border-slate-800">
          {[
            { id: AppView.DASHBOARD, icon: Home, label: 'Safe' },
            { id: AppView.GUARDIAN_LINK, icon: Activity, label: 'Link' },
            { id: AppView.SETTINGS, icon: Settings, label: 'Setup' }
          ].map(item => (
            <button key={item.id} onClick={() => setView(item.id)} className={`flex flex-col items-center gap-1.5 px-6 py-2.5 rounded-2xl transition-all ${view === item.id ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-600'}`}>
              <item.icon size={20} />
              <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default App;
