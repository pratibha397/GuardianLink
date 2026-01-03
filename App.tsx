
import { Home, LogOut, Radio, Settings, Shield } from 'lucide-react';
import React, { useState } from 'react';
import AlertHistory from './components/AlertHistory';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import SettingsPanel from './components/SettingsPanel';
import { AppSettings, AppView, User } from './types';

const DEFAULT_SETTINGS: AppSettings = {
  triggerPhrase: 'Aegis, help me',
  checkInDuration: 15,
  contacts: [],
  isListening: false
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('aegis_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [appView, setAppView] = useState<AppView>(AppView.DASHBOARD);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isEmergency, setIsEmergency] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('aegis_user');
    setUser(null);
  };

  if (!user) {
    return <AuthScreen onLogin={(u) => { setUser(u); localStorage.setItem('aegis_user', JSON.stringify(u)); }} />;
  }

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-[#020617] relative text-slate-100 font-sans selection:bg-sky-500/30">
      <header className="p-6 bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-50 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isEmergency ? 'bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-slate-900'}`}>
            <Shield size={20} className={isEmergency ? 'text-white' : 'text-sky-500'} />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight italic leading-none">AEGIS</h1>
            <p className="text-[8px] mono text-slate-500 uppercase font-bold tracking-[0.3em] mt-1">Mesh Secure</p>
          </div>
        </div>
        <button onClick={handleLogout} className="p-2 text-slate-600 hover:text-red-500 transition-colors">
          <LogOut size={16} />
        </button>
      </header>

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
        {appView === AppView.SETTINGS && <SettingsPanel settings={settings} updateSettings={(s) => setSettings(p => ({...p, ...s}))} />}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-6 bg-gradient-to-t from-[#020617] to-transparent z-50">
        <div className="flex justify-around items-center glass p-2 rounded-full border border-white/5 shadow-2xl">
          {[
            { id: AppView.DASHBOARD, icon: Home, label: 'Safety' },
            { id: AppView.MESH, icon: Radio, label: 'Feed' },
            { id: AppView.SETTINGS, icon: Settings, label: 'Mesh' }
          ].map(item => (
            <button 
              key={item.id} 
              onClick={() => setAppView(item.id)} 
              className={`flex items-center gap-2 px-6 py-3 rounded-full transition-all ${appView === item.id ? 'bg-sky-500 text-white shadow-xl' : 'text-slate-600'}`}
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
