
import { AlertTriangle, Home, LogOut, Radio, Settings, Shield } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import AlertHistory from './components/AlertHistory';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import SettingsPanel from './components/SettingsPanel';
import { AppSettings, AppView, User } from './types';

const SETTINGS_KEY = 'guardian_settings_v1';

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
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [isEmergency, setIsEmergency] = useState(false);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const isConfigured = !!(process.env.API_KEY);

  const handleLogout = () => {
    localStorage.removeItem('guardian_user');
    setUser(null);
  };

  if (!user) {
    return <AuthScreen onLogin={(u) => { setUser(u); localStorage.setItem('guardian_user', JSON.stringify(u)); }} />;
  }

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-[#020617] relative text-slate-100 font-sans shadow-2xl">
      <header className="p-6 bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-50 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isEmergency ? 'bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-blue-600'}`}>
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight leading-none uppercase text-white">GuardianLink</h1>
            <p className="text-[8px] mono text-slate-500 uppercase font-bold tracking-[0.3em] mt-1">
              {isConfigured ? 'Link Established' : 'System Offline'}
            </p>
          </div>
        </div>
        <button onClick={handleLogout} className="p-2 text-slate-600 hover:text-red-500 transition-colors">
          <LogOut size={18} />
        </button>
      </header>

      {!isConfigured && (
        <div className="mx-6 mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          <p className="text-[9px] font-bold uppercase text-amber-500 tracking-wider">
            Critical configuration missing. Please check API settings.
          </p>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-6 pb-28">
        {appView === AppView.DASHBOARD && (
          <Dashboard 
            user={user} 
            settings={settings} 
            updateSettings={(s) => setSettings(p => ({...p, ...s}))}
            isEmergency={isEmergency}
            onAlert={() => setIsEmergency(true)}
          />
        )}
        {appView === AppView.MESH && <AlertHistory user={user} logs={[]} clearLogs={() => {}} />}
        {appView === AppView.SETTINGS && (
          <SettingsPanel settings={settings} updateSettings={(s) => setSettings(p => ({...p, ...s}))} />
        )}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-6 bg-gradient-to-t from-[#020617] via-[#020617] to-transparent z-50">
        <div className="flex justify-around items-center glass p-2 rounded-[2rem] border border-white/10 shadow-2xl">
          {[
            { id: AppView.DASHBOARD, icon: Home, label: 'Safety' },
            { id: AppView.MESH, icon: Radio, label: 'Network' },
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
