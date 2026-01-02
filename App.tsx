
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, Settings, Activity, AlertCircle, Phone, MapPin, UserPlus, Trash2, Home } from 'lucide-react';
import { EmergencyContact, AppSettings, AppView, AlertLog } from './types';
import Dashboard from './components/Dashboard';
import SettingsPanel from './components/SettingsPanel';
import AlertHistory from './components/AlertHistory';

const STORAGE_KEY = 'guardian_voice_settings';
const LOGS_KEY = 'guardian_voice_logs';

const DEFAULT_SETTINGS: AppSettings = {
  triggerPhrase: 'Help help',
  messageTemplate: 'EMERGENCY! I need help. My current location is: {location}',
  contacts: [],
  isListening: false
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);

  // Load persistence
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setSettings(prev => ({ ...prev, ...JSON.parse(saved), isListening: false }));
    }
    const savedLogs = localStorage.getItem(LOGS_KEY);
    if (savedLogs) {
      setLogs(JSON.parse(savedLogs));
    }
  }, []);

  // Save persistence
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, isListening: false }));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  }, [logs]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const addLog = (log: AlertLog) => {
    setLogs(prev => [log, ...prev]);
    setIsEmergencyActive(true);
    // Automatically revert emergency status visual after 10 seconds
    setTimeout(() => setIsEmergencyActive(false), 10000);
  };

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-slate-900 shadow-2xl overflow-hidden relative border-x border-slate-800">
      {/* Header */}
      <header className="p-6 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isEmergencyActive ? 'bg-red-500 text-white emergency-pulse' : 'bg-blue-600 text-white'}`}>
            <Shield size={24} />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight">GuardianVoice</h1>
            <p className="text-xs text-slate-400 font-medium">Personal Protection AI</p>
          </div>
        </div>
        <div className="flex gap-2">
           <button 
            onClick={() => setView(AppView.SETTINGS)}
            className={`p-2 rounded-lg transition-colors ${view === AppView.SETTINGS ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 pb-24">
        {view === AppView.DASHBOARD && (
          <Dashboard 
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

      {/* Persistent Bottom Nav */}
      <nav className="absolute bottom-0 left-0 right-0 p-4 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 z-20">
        <div className="flex justify-around items-center">
          <button 
            onClick={() => setView(AppView.DASHBOARD)}
            className={`flex flex-col items-center gap-1 transition-colors ${view === AppView.DASHBOARD ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Home size={22} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Monitor</span>
          </button>
          
          <button 
            onClick={() => setView(AppView.ALERT_HISTORY)}
            className={`flex flex-col items-center gap-1 transition-colors ${view === AppView.ALERT_HISTORY ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Activity size={22} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Logs</span>
          </button>

          <button 
            onClick={() => setView(AppView.SETTINGS)}
            className={`flex flex-col items-center gap-1 transition-colors ${view === AppView.SETTINGS ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Settings size={22} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Settings</span>
          </button>
        </div>
      </nav>
      
      {/* Visual Emergency Overlay */}
      {isEmergencyActive && (
        <div className="absolute inset-0 bg-red-600/20 pointer-events-none z-10 animate-pulse border-4 border-red-500" />
      )}
    </div>
  );
};

export default App;
