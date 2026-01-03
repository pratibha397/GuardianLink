
import React, { useEffect, useRef, useState } from 'react';
// Added AlertCircle to imports
import { AlertCircle, MapPin, Power, Radio, Send, ShieldCheck, Users } from 'lucide-react';
import { GeminiVoiceMonitor } from '../services/geminiService';
import { AlertLog, AppSettings, User as AppUser, ChatMessage } from '../types';

interface DashboardProps {
  user: AppUser;
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
  onAlertTriggered: (log: AlertLog) => void;
  isEmergency: boolean;
}

const GLOBAL_ALERTS_KEY = 'guardian_voice_global_alerts';

const Dashboard: React.FC<DashboardProps> = ({ user, settings, updateSettings, onAlertTriggered, isEmergency }) => {
  const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number} | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [activeAlert, setActiveAlert] = useState<AlertLog | null>(null);
  const monitorRef = useRef<GeminiVoiceMonitor | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Requirement: Only registered app users receive the message
  const registeredContacts = settings.contacts.filter(c => c.isRegisteredUser);

  // SYNC LOOP: Get responses from guardians on the same app
  useEffect(() => {
    if (!isEmergency) {
      setActiveAlert(null);
      return;
    }

    const syncWithServer = () => {
      const all: AlertLog[] = JSON.parse(localStorage.getItem(GLOBAL_ALERTS_KEY) || '[]');
      const mine = all.find(a => a.senderPhone === user.phone && a.isLive);
      if (mine) setActiveAlert(mine);
    };

    const interval = setInterval(syncWithServer, 2000);
    return () => clearInterval(interval);
  }, [isEmergency, user.phone]);

  // BROADCAST LOOP: Push live location to the app network
  useEffect(() => {
    if (settings.isListening || isEmergency) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentCoords(coords);
          if (isEmergency) {
            // Update the global alert entry with the latest coordinates for guardians to see
            const all: AlertLog[] = JSON.parse(localStorage.getItem(GLOBAL_ALERTS_KEY) || '[]');
            const idx = all.findIndex(a => a.senderPhone === user.phone && a.isLive);
            if (idx !== -1) {
              all[idx].location = coords;
              localStorage.setItem(GLOBAL_ALERTS_KEY, JSON.stringify(all));
            }
          }
        },
        null,
        { enableHighAccuracy: true }
      );
    } else {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    }
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [settings.isListening, isEmergency, user.phone]);

  const triggerAlert = () => {
    if (registeredContacts.length === 0) {
      setError("Alert Aborted: You have no 'App Registered' guardians. Please add one in Setup.");
      return;
    }

    const newLog: AlertLog = {
      id: Date.now().toString(),
      senderPhone: user.phone,
      senderName: user.name,
      timestamp: Date.now(),
      location: currentCoords,
      message: "EMERGENCY: Situation detected. Live location link established.",
      updates: [],
      isLive: true,
      recipients: registeredContacts.map(c => c.phone)
    };

    onAlertTriggered(newLog);
    setActiveAlert(newLog);
    setError(null);
  };

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !activeAlert) return;

    const all: AlertLog[] = JSON.parse(localStorage.getItem(GLOBAL_ALERTS_KEY) || '[]');
    const idx = all.findIndex(a => a.id === activeAlert.id);
    
    if (idx !== -1) {
      const msg: ChatMessage = {
        id: Date.now().toString(),
        senderName: user.name,
        text: chatMessage,
        timestamp: Date.now()
      };
      all[idx].updates.push(msg);
      localStorage.setItem(GLOBAL_ALERTS_KEY, JSON.stringify(all));
      setChatMessage('');
    }
  };

  const toggleListening = async () => {
    if (settings.isListening) {
      if (monitorRef.current) await monitorRef.current.stop();
      monitorRef.current = null;
      updateSettings({ isListening: false });
    } else {
      setError(null);
      const monitor = new GeminiVoiceMonitor({
        triggerPhrase: settings.triggerPhrase,
        onAlert: () => triggerAlert(),
        onError: (err) => { setError(err); updateSettings({ isListening: false }); }
      });
      await monitor.start();
      monitorRef.current = monitor;
      updateSettings({ isListening: true });
    }
  };

  return (
    <div className="space-y-6">
      {!isEmergency ? (
        <div className={`p-10 rounded-[3rem] flex flex-col items-center justify-center transition-all duration-700 border-2 ${settings.isListening ? 'bg-blue-600/10 border-blue-500/50 shadow-[0_0_80px_rgba(37,99,235,0.2)]' : 'bg-slate-900 border-slate-800'}`}>
          <button onClick={toggleListening} className={`w-32 h-32 rounded-full flex items-center justify-center transition-all active:scale-90 relative ${settings.isListening ? 'bg-blue-600' : 'bg-slate-800 shadow-inner'}`}>
            {settings.isListening && <div className="absolute inset-0 rounded-full animate-ping bg-blue-500/20" />}
            <Power size={56} className={settings.isListening ? 'text-white' : 'text-slate-600'} />
          </button>
          <div className="mt-8 text-center space-y-1">
            <h2 className="text-2xl font-black text-white italic tracking-tighter">
              {settings.isListening ? 'Guardian Linked' : 'System Paused'}
            </h2>
            <div className="flex items-center gap-2 justify-center">
              {settings.isListening && <Radio size={14} className="text-blue-500 animate-pulse" />}
              <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest italic">
                {settings.isListening ? `Broadcasting on: "${settings.triggerPhrase}"` : 'AI Passive Mode'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-in zoom-in duration-500">
          <div className="bg-blue-700 p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-blue-400/50">
             <div className="flex items-center gap-4">
                <div className="bg-white p-2 rounded-2xl text-blue-700 shadow-xl"><ShieldCheck size={28} /></div>
                <div>
                  <h4 className="font-black text-white leading-tight">Live Broadcast Hub</h4>
                  <div className="flex items-center gap-2 text-[9px] text-blue-100 font-black uppercase tracking-wider">
                    <Radio size={12} className="animate-pulse" /> Network Active • {registeredContacts.length} Guards
                  </div>
                </div>
             </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 h-[380px] flex flex-col shadow-inner">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl text-xs text-blue-100 italic">
                {activeAlert?.message}
              </div>
              {activeAlert?.updates.map(msg => (
                <div key={msg.id} className={`max-w-[85%] p-4 rounded-2xl text-[11px] leading-relaxed ${msg.senderName === user.name ? 'ml-auto bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                  <div className="font-black uppercase text-[8px] mb-1 opacity-70 tracking-widest">{msg.senderName}</div>
                  {msg.text}
                </div>
              ))}
            </div>
            <form onSubmit={sendChatMessage} className="mt-4 relative group">
              <input 
                type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} 
                placeholder="Broadcast update..." 
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-5 pr-14 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30" 
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-500">
                <Send size={18}/>
              </button>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-[2rem] text-red-500 text-[10px] font-black uppercase flex items-center gap-3">
          <AlertCircle size={24} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 h-36 flex flex-col justify-between shadow-xl">
          <Users size={20} className="text-blue-500" />
          <div>
            <div className="text-3xl font-black text-white italic">{registeredContacts.length}</div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Network Linked</span>
          </div>
        </div>
        <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 h-36 flex flex-col justify-between shadow-xl">
          <MapPin size={20} className={currentCoords ? 'text-blue-500 animate-pulse' : 'text-slate-700'} />
          <div>
            <div className="text-lg font-black text-white italic">{currentCoords ? 'Live Stream' : 'GPS Offline'}</div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Packet Tracking</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
