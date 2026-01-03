
import { MapPin, Power, Radio, Send, ShieldCheck, Users } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { GeminiVoiceMonitor } from '../services/geminiService';
import { AlertLog, AppSettings, User as AppUser, ChatMessage } from '../types';

interface DashboardProps {
  user: AppUser;
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
  onAlertTriggered: (log: AlertLog) => void;
  isEmergency: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ user, settings, updateSettings, onAlertTriggered, isEmergency }) => {
  const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number} | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [activeAlert, setActiveAlert] = useState<AlertLog | null>(null);
  const monitorRef = useRef<GeminiVoiceMonitor | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const registeredContacts = settings.contacts.filter(c => c.isRegisteredUser);

  // Sync with global alert state to get guardian replies
  useEffect(() => {
    if (!isEmergency) {
      setActiveAlert(null);
      return;
    }

    const interval = setInterval(() => {
      const all: AlertLog[] = JSON.parse(localStorage.getItem('guardian_voice_global_alerts') || '[]');
      const mine = all.find(a => a.senderPhone === user.phone && a.isLive);
      if (mine) setActiveAlert(mine);
    }, 2000);

    return () => clearInterval(interval);
  }, [isEmergency, user.phone]);

  useEffect(() => {
    if (settings.isListening || isEmergency) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentCoords(coords);
          if (isEmergency) updateGlobalLocation(coords);
        },
        null,
        { enableHighAccuracy: true }
      );
    } else {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    }
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [settings.isListening, isEmergency]);

  const updateGlobalLocation = (coords: {lat: number, lng: number}) => {
    const GLOBAL_KEY = 'guardian_voice_global_alerts';
    const alerts: AlertLog[] = JSON.parse(localStorage.getItem(GLOBAL_KEY) || '[]');
    const idx = alerts.findIndex(a => a.senderPhone === user.phone && a.isLive);
    if (idx !== -1) {
      alerts[idx].location = coords;
      localStorage.setItem(GLOBAL_KEY, JSON.stringify(alerts));
    }
  };

  const triggerAlert = (initialMsg?: string) => {
    if (registeredContacts.length === 0) {
      setError("No registered guardians found. Update settings.");
      return;
    }

    const newLog: AlertLog = {
      id: Date.now().toString(),
      senderPhone: user.phone,
      senderName: user.name,
      timestamp: Date.now(),
      location: currentCoords,
      message: initialMsg || "DANGER: Trigger detected. Tracking live now.",
      updates: [],
      isLive: true,
      recipients: registeredContacts.map(c => c.phone)
    };

    onAlertTriggered(newLog);
    setActiveAlert(newLog);
  };

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !activeAlert) return;

    const GLOBAL_KEY = 'guardian_voice_global_alerts';
    const all: AlertLog[] = JSON.parse(localStorage.getItem(GLOBAL_KEY) || '[]');
    const idx = all.findIndex(a => a.id === activeAlert.id);
    
    if (idx !== -1) {
      const msg: ChatMessage = {
        id: Date.now().toString(),
        senderName: user.name,
        text: chatMessage,
        timestamp: Date.now()
      };
      all[idx].updates.push(msg);
      localStorage.setItem(GLOBAL_KEY, JSON.stringify(all));
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
          <button onClick={toggleListening} className={`w-32 h-32 rounded-full flex items-center justify-center transition-all active:scale-90 relative ${settings.isListening ? 'bg-blue-600' : 'bg-slate-800'}`}>
            {settings.isListening && <div className="absolute inset-0 rounded-full animate-ping bg-blue-500/20" />}
            <Power size={56} className={settings.isListening ? 'text-white' : 'text-slate-600'} />
          </button>
          <div className="mt-8 text-center">
            <h2 className="text-2xl font-black text-white italic">{settings.isListening ? 'Monitoring Link' : 'Offline'}</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-2">AI Analyzing Audio Stream</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-in zoom-in duration-500">
          <div className="bg-blue-700 p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
             <div className="flex items-center gap-4">
                <div className="bg-white p-2 rounded-2xl text-blue-700"><ShieldCheck size={28} /></div>
                <div>
                  <h4 className="font-black text-white">Live Crisis Link</h4>
                  <div className="flex items-center gap-2 text-[10px] text-blue-100 font-black uppercase"><Radio size={12} className="animate-pulse" /> Registered Guardians Linked</div>
                </div>
             </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 h-[350px] flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl text-xs text-blue-100 italic">
                {activeAlert?.message}
              </div>
              {activeAlert?.updates.map(msg => (
                <div key={msg.id} className={`max-w-[85%] p-4 rounded-2xl text-xs ${msg.senderName === user.name ? 'ml-auto bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                  <div className="font-black uppercase text-[8px] mb-1 opacity-70">{msg.senderName}</div>
                  {msg.text}
                </div>
              ))}
            </div>
            <form onSubmit={sendChatMessage} className="mt-4 flex gap-2">
              <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder="Type update..." className="grow bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-xs text-white focus:outline-none" />
              <button type="submit" className="p-3 bg-blue-600 text-white rounded-xl shadow-lg"><Send size={18}/></button>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 h-32 flex flex-col justify-between">
          <Users size={20} className="text-blue-500" />
          <div>
            <div className="text-2xl font-black text-white">{registeredContacts.length}</div>
            <span className="text-[10px] font-black text-slate-500 uppercase">Linked Guards</span>
          </div>
        </div>
        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 h-32 flex flex-col justify-between">
          <MapPin size={20} className={currentCoords ? 'text-green-500' : 'text-slate-600'} />
          <div>
            <div className="text-lg font-black text-white">{currentCoords ? 'Active' : 'Offline'}</div>
            <span className="text-[10px] font-black text-slate-500 uppercase">Live GPS</span>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-red-500 text-xs font-bold text-center">{error}</div>}
    </div>
  );
};

export default Dashboard;
