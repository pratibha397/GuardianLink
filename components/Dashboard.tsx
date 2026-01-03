
import { AlertCircle, Lock, MapPin, MessageCircle, Navigation, Power, Radio, Send, ShieldCheck, Unlock, Users } from 'lucide-react';
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
  const chatEndRef = useRef<HTMLDivElement>(null);

  const registeredContacts = settings.contacts.filter(c => c.isRegisteredUser);

  // Scroll to new messages automatically
  useEffect(() => {
    if (activeAlert?.updates.length) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeAlert?.updates]);

  // Keep screen on during security monitoring
  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          const lock = await (navigator as any).wakeLock.request('screen');
          setWakeLock(lock);
        } catch (err) {
          console.warn('Wake Lock failed:', err);
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

  // Two-way sync: polling for chat updates from guardians
  useEffect(() => {
    if (!isEmergency) {
      setActiveAlert(null);
      return;
    }
    const syncUpdates = () => {
      const all: AlertLog[] = JSON.parse(localStorage.getItem(GLOBAL_ALERTS_KEY) || '[]');
      const mine = all.find(a => a.senderPhone === user.phone && a.isLive);
      if (mine) setActiveAlert(mine);
    };
    const interval = setInterval(syncUpdates, 1000); // 1s sync for real-time chat feel
    return () => clearInterval(interval);
  }, [isEmergency, user.phone]);

  // Continuous high-frequency GPS stream
  useEffect(() => {
    if (settings.isListening || isEmergency) {
      const geoOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0 
      };

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentCoords(coords);
          
          // If emergency is active, immediately push location to global registry
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
          console.error("GPS stream error:", err);
          if (err.code === 1) setError("Location access is required for emergency features.");
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
      setError("Emergency block: You must link at least one registered Guardian in settings.");
      return;
    }

    // Capture location specifically for the trigger moment
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentCoords(coords);
        broadcast(coords);
      },
      (err) => {
        console.warn("Failed immediate GPS capture, using last known.");
        broadcast(currentCoords);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );

    const broadcast = (loc: {lat: number, lng: number} | null) => {
      const newLog: AlertLog = {
        id: Date.now().toString(),
        senderPhone: user.phone,
        senderName: user.name,
        timestamp: Date.now(),
        location: loc,
        message: "🚨 EMERGENCY TRIGGERED 🚨 Location broadcast started automatically.",
        updates: [],
        isLive: true,
        recipients: registeredContacts.map(c => c.phone)
      };

      onAlertTriggered(newLog);
      setActiveAlert(newLog);
      setError(null);
    };
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
        timestamp: Date.now(),
        location: currentCoords || undefined
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
      <div className={`p-4 rounded-[1.5rem] flex items-center justify-between transition-all duration-500 border ${wakeLock ? 'bg-green-500/10 border-green-500/20 text-green-500 shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-600 shadow-inner'}`}>
        <div className="flex items-center gap-3">
          {wakeLock ? <Lock size={14} className="animate-pulse" /> : <Unlock size={14} />}
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">
            {wakeLock ? 'Active Security Mesh' : 'Standby Mode'}
          </span>
        </div>
        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${currentCoords ? 'bg-blue-500 animate-pulse' : 'bg-slate-700'}`} />
           <span className="text-[8px] font-black uppercase tracking-widest">{currentCoords ? 'GPS Live' : 'Locating...'}</span>
        </div>
      </div>

      {!isEmergency ? (
        <div className={`relative p-14 rounded-[4rem] flex flex-col items-center justify-center transition-all duration-1000 border-2 overflow-hidden ${settings.isListening ? 'bg-blue-600/5 border-blue-500/40 shadow-[0_0_150px_rgba(37,99,235,0.2)]' : 'bg-slate-900 border-slate-800 shadow-2xl'}`}>
          {settings.isListening && (
             <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-blue-500/5 rounded-full animate-ping [animation-duration:4s]" />
             </div>
          )}
          
          <button 
            onClick={toggleListening} 
            className={`w-44 h-44 rounded-full flex items-center justify-center transition-all active:scale-90 z-10 relative ${settings.isListening ? 'bg-blue-600 shadow-[0_40px_80px_rgba(37,99,235,0.4)]' : 'bg-slate-800 shadow-[inset_0_4px_12px_rgba(0,0,0,0.6)] border-t border-slate-700'}`}
          >
            <Power size={80} className={settings.isListening ? 'text-white' : 'text-slate-600'} />
          </button>

          <div className="mt-12 text-center space-y-3">
            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
              {settings.isListening ? 'AI Guard On' : 'AI Guard Off'}
            </h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em] italic leading-relaxed">
              {settings.isListening ? `Trigger: "${settings.triggerPhrase}"` : 'Touch to Secure Mesh'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5 animate-in slide-in-from-bottom-10 duration-700">
          <div className="bg-red-600 p-8 rounded-[3rem] shadow-[0_40px_100px_rgba(220,38,38,0.4)] relative overflow-hidden border border-red-400/50">
             <div className="flex items-center gap-5 relative z-10">
                <div className="bg-white p-4 rounded-3xl text-red-600 shadow-2xl rotate-6 border-4 border-red-400/20"><ShieldCheck size={36} /></div>
                <div className="flex-1">
                  <h4 className="font-black text-2xl text-white italic leading-tight tracking-tighter">Emergency Alert</h4>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-red-100 font-black uppercase tracking-widest bg-white/20 w-fit px-4 py-1.5 rounded-full backdrop-blur-md">
                    <Radio size={12} className="animate-pulse" /> Tracking: {currentCoords?.lat.toFixed(4)}, {currentCoords?.lng.toFixed(4)}
                  </div>
                </div>
             </div>
             <div className="absolute -right-10 -bottom-10 opacity-10 rotate-12 text-white">
                <Navigation size={180} />
             </div>
          </div>

          <div className="bg-slate-900 p-7 rounded-[3.5rem] border border-slate-800 h-[520px] flex flex-col shadow-[0_50px_120px_rgba(0,0,0,0.6)] relative">
            <div className="flex items-center gap-3 mb-6 px-2 mt-2">
               <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500 shadow-sm"><MessageCircle size={18} /></div>
               <h5 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 italic">Guardian Tactical Chat</h5>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 px-2 custom-scrollbar">
              <div className="bg-blue-600/10 border border-blue-500/20 p-5 rounded-[2rem] text-[11px] text-blue-100/90 italic leading-relaxed shadow-inner border-dashed">
                {activeAlert?.message}
              </div>
              
              {activeAlert?.updates.map(msg => (
                <div key={msg.id} className={`max-w-[88%] p-5 rounded-[2rem] text-[12px] shadow-xl animate-in fade-in slide-in-from-bottom-2 ${msg.senderName === user.name ? 'ml-auto bg-blue-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'}`}>
                  <div className="flex justify-between items-center mb-1.5 opacity-60">
                    <span className="font-black uppercase text-[8px] tracking-[0.2em]">{msg.senderName}</span>
                    <span className="text-[8px] font-bold">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className="font-medium leading-snug">{msg.text}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={sendChatMessage} className="mt-6 relative group px-1">
              <input 
                type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} 
                placeholder="Broadcast status or info..." 
                className="w-full bg-slate-950 border border-slate-800 rounded-[2rem] py-5 pl-7 pr-16 text-sm text-white font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 shadow-inner transition-all" 
              />
              <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-blue-600 text-white rounded-[1.4rem] shadow-2xl hover:bg-blue-500 active:scale-95 transition-all">
                <Send size={22}/>
              </button>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-7 rounded-[3rem] text-red-500 text-[11px] font-black uppercase flex items-center gap-5 animate-bounce shadow-2xl">
          <div className="p-3 bg-red-500/20 rounded-2xl"><AlertCircle size={24} className="shrink-0" /></div>
          <span className="leading-tight flex-1">{error}</span>
        </div>
      )}

      {!isEmergency && (
        <div className="grid grid-cols-2 gap-5 pb-6">
          <div className="bg-slate-900 p-8 rounded-[3.5rem] border border-slate-800 h-48 flex flex-col justify-between shadow-xl group hover:border-blue-500/30 transition-all cursor-pointer">
            <div className="p-3 bg-blue-600/10 rounded-2xl w-fit text-blue-500 group-hover:scale-110 transition-transform"><Users size={28} /></div>
            <div>
              <div className="text-5xl font-black text-white italic tracking-tighter leading-none">{registeredContacts.length}</div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 inline-block">Mesh Guards</span>
            </div>
          </div>
          <div className="bg-slate-900 p-8 rounded-[3.5rem] border border-slate-800 h-48 flex flex-col justify-between shadow-xl group hover:border-blue-500/30 transition-all cursor-pointer">
            <div className={`p-3 rounded-2xl w-fit ${currentCoords ? 'bg-blue-600/10 text-blue-500 animate-pulse' : 'bg-slate-800 text-slate-700'}`}><MapPin size={28} /></div>
            <div>
              <div className="text-xl font-black text-white italic leading-tight tracking-tighter truncate">{currentCoords ? 'Satellite Active' : 'Offline'}</div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 inline-block">Location Link</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
