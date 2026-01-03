
import { AlertCircle, Lock, MapPin, Navigation, Power, Radio, Send, ShieldCheck, Unlock, Users } from 'lucide-react';
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

const GLOBAL_ALERTS_KEY = 'guardian_voice_global_alerts';

const Dashboard: React.FC<DashboardProps> = ({ user, settings, updateSettings, onAlertTriggered, isEmergency }) => {
  const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number} | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [activeAlert, setActiveAlert] = useState<AlertLog | null>(null);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const monitorRef = useRef<GeminiVoiceMonitor | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const registeredContacts = settings.contacts.filter(c => c.isRegisteredUser);

  // Manage Wake Lock for persistent background execution
  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          const lock = await (navigator as any).wakeLock.request('screen');
          setWakeLock(lock);
        } catch (err) {
          console.warn('Wake Lock request failed:', err);
        }
      }
    };

    if (settings.isListening || isEmergency) {
      requestWakeLock();
    } else if (wakeLock) {
      wakeLock.release().then(() => setWakeLock(null));
    }

    return () => { if (wakeLock) wakeLock.release(); };
  }, [settings.isListening, isEmergency]);

  // SYNC LOOP: Receiver updates
  useEffect(() => {
    if (!isEmergency) {
      setActiveAlert(null);
      return;
    }
    const sync = () => {
      const all: AlertLog[] = JSON.parse(localStorage.getItem(GLOBAL_ALERTS_KEY) || '[]');
      const mine = all.find(a => a.senderPhone === user.phone && a.isLive);
      if (mine) setActiveAlert(mine);
    };
    const interval = setInterval(sync, 1500);
    return () => clearInterval(interval);
  }, [isEmergency, user.phone]);

  // HIGH-PRECISION BROADCAST: Continuous GPS Streaming
  useEffect(() => {
    if (settings.isListening || isEmergency) {
      const geoOptions = {
        enableHighAccuracy: true,
        timeout: Infinity,
        maximumAge: 0 // Force fresh reading for "Live" movement
      };

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentCoords(coords);
          
          if (isEmergency) {
            const all: AlertLog[] = JSON.parse(localStorage.getItem(GLOBAL_ALERTS_KEY) || '[]');
            const idx = all.findIndex(a => a.senderPhone === user.phone && a.isLive);
            if (idx !== -1) {
              all[idx].location = coords;
              localStorage.setItem(GLOBAL_ALERTS_KEY, JSON.stringify(all));
            }
          }
        },
        (err) => {
          console.error("Broadcast Error:", err);
          if (err.code === 1) setError("Location permission denied. Critical for live link.");
        },
        geoOptions
      );
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [settings.isListening, isEmergency, user.phone]);

  const triggerAlert = () => {
    if (registeredContacts.length === 0) {
      setError("No Guardians Found: You must add app-registered guardians to trigger an alert.");
      return;
    }

    const newLog: AlertLog = {
      id: Date.now().toString(),
      senderPhone: user.phone,
      senderName: user.name,
      timestamp: Date.now(),
      location: currentCoords,
      message: "DANGER: Trigger detected. Streaming live coordinates to your network.",
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
      {/* Network Status Bar */}
      <div className={`p-4 rounded-[1.5rem] flex items-center justify-between transition-all duration-500 border ${wakeLock ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
        <div className="flex items-center gap-3">
          {wakeLock ? <Lock size={14} className="animate-pulse" /> : <Unlock size={14} />}
          <span className="text-[10px] font-black uppercase tracking-[0.1em]">
            {wakeLock ? 'Secure Background Lock' : 'Standby Protection'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${currentCoords ? 'bg-blue-500 animate-pulse' : 'bg-slate-700'}`} />
          <span className="text-[8px] font-bold uppercase">{currentCoords ? 'GPS Live' : 'GPS Locating'}</span>
        </div>
      </div>

      {!isEmergency ? (
        <div className={`relative p-12 rounded-[3.5rem] flex flex-col items-center justify-center transition-all duration-1000 border-2 overflow-hidden ${settings.isListening ? 'bg-blue-600/5 border-blue-500/40 shadow-[0_0_100px_rgba(37,99,235,0.1)]' : 'bg-slate-900 border-slate-800'}`}>
          {settings.isListening && (
             <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-500/5 rounded-full animate-[ping_3s_infinite]" />
             </div>
          )}
          
          <button 
            onClick={toggleListening} 
            className={`w-36 h-36 rounded-full flex items-center justify-center transition-all active:scale-95 z-10 relative ${settings.isListening ? 'bg-blue-600 shadow-[0_20px_40px_rgba(37,99,235,0.4)]' : 'bg-slate-800 shadow-inner'}`}
          >
            <Power size={64} className={settings.isListening ? 'text-white' : 'text-slate-600'} />
          </button>

          <div className="mt-10 text-center space-y-2">
            <h2 className="text-3xl font-black text-white italic tracking-tighter">
              {settings.isListening ? 'Shield Active' : 'Shield Offline'}
            </h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] italic">
              {settings.isListening ? `Trigger: "${settings.triggerPhrase}"` : 'Guardian Standing By'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-in slide-in-from-bottom-6 duration-700">
          <div className="bg-blue-700 p-8 rounded-[3rem] shadow-[0_30px_60px_rgba(29,78,216,0.3)] relative overflow-hidden border border-blue-400/30">
             <div className="flex items-center gap-5 relative z-10">
                <div className="bg-white p-3 rounded-3xl text-blue-700 shadow-2xl rotate-12"><ShieldCheck size={32} /></div>
                <div>
                  <h4 className="font-black text-xl text-white italic leading-none">Emergency Broadcast</h4>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-blue-100 font-black uppercase tracking-widest">
                    <Radio size={12} className="animate-pulse" /> Linked to {registeredContacts.length} Registered Guardians
                  </div>
                </div>
             </div>
             <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12 text-white">
                <Navigation size={120} />
             </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-[3rem] border border-slate-800 h-[420px] flex flex-col shadow-2xl">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              <div className="bg-blue-600/10 border border-blue-500/10 p-5 rounded-2xl text-[11px] text-blue-100/70 italic leading-relaxed">
                {activeAlert?.message}
              </div>
              {activeAlert?.updates.map(msg => (
                <div key={msg.id} className={`max-w-[85%] p-4 rounded-2xl text-[11px] leading-relaxed shadow-sm ${msg.senderName === user.name ? 'ml-auto bg-blue-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-300 border border-slate-700 rounded-bl-none'}`}>
                  <div className="font-black uppercase text-[7px] mb-1 opacity-60 tracking-widest">{msg.senderName}</div>
                  {msg.text}
                </div>
              ))}
            </div>
            <form onSubmit={sendChatMessage} className="mt-5 relative group">
              <input 
                type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} 
                placeholder="Tactical update..." 
                className="w-full bg-slate-950 border border-slate-800 rounded-[1.5rem] py-5 pl-6 pr-16 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" 
              />
              <button type="submit" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-3 bg-blue-600 text-white rounded-2xl shadow-lg hover:bg-blue-500 active:scale-95 transition-all">
                <Send size={20}/>
              </button>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-[2.5rem] text-red-500 text-[10px] font-black uppercase flex items-center gap-4 animate-bounce">
          <AlertCircle size={28} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-slate-900 p-7 rounded-[2.5rem] border border-slate-800 h-40 flex flex-col justify-between shadow-xl group hover:border-blue-500/30 transition-all">
          <Users size={24} className="text-blue-500 group-hover:scale-110 transition-transform" />
          <div>
            <div className="text-4xl font-black text-white italic tracking-tighter">{registeredContacts.length}</div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Guards Verified</span>
          </div>
        </div>
        <div className="bg-slate-900 p-7 rounded-[2.5rem] border border-slate-800 h-40 flex flex-col justify-between shadow-xl group hover:border-blue-500/30 transition-all">
          <MapPin size={24} className={currentCoords ? 'text-blue-500 animate-pulse' : 'text-slate-700'} />
          <div>
            <div className="text-lg font-black text-white italic leading-tight">{currentCoords ? 'Streaming GPS' : 'GPS Locking'}</div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Live Packets</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
