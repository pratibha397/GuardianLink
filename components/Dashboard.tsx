
import { AlertCircle, Lock, MapPin, MessageCircle, Navigation, Power, Radio, Send, ShieldAlert, ShieldCheck, Unlock, Users } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { LocationCoords, startLocationTracking, stopLocationTracking } from '../services/LocationService';
import { DataSnapshot, onValue, push, ref, rtdb, set, update } from '../services/firebase';
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
  const [currentCoords, setCurrentCoords] = useState<LocationCoords | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [activeAlert, setActiveAlert] = useState<AlertLog | null>(null);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const monitorRef = useRef<GeminiVoiceMonitor | null>(null);
  const watchIdRef = useRef<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Web Speech API Fallback
  const recognitionRef = useRef<any>(null);

  const registeredContacts = settings.contacts.filter(c => c.isRegisteredUser);

  // Hybrid Voice Detection: Web Speech API for "HELP"
  useEffect(() => {
    if (settings.isListening && !isEmergency) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.lang = 'en-US';
        recognitionRef.current.onresult = (event: any) => {
          const last = event.results.length - 1;
          const text = event.results[last][0].transcript.toUpperCase();
          if (text.includes('HELP') || text.includes(settings.triggerPhrase.toUpperCase())) {
            triggerAlert(false);
          }
        };
        recognitionRef.current.start();
      }
    } else {
      recognitionRef.current?.stop();
    }
    return () => recognitionRef.current?.stop();
  }, [settings.isListening, isEmergency, settings.triggerPhrase]);

  useEffect(() => {
    if (!isEmergency) {
      setActiveAlert(null);
      return;
    }
    
    const alertsRef = ref(rtdb, 'alerts');
    const unsubscribe = onValue(alertsRef, (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (data) {
        const mine = Object.values(data).find((a: any) => 
          a.senderPhone === user.phone && a.isLive
        ) as AlertLog;
        if (mine) setActiveAlert(mine);
      }
    });

    return () => unsubscribe();
  }, [isEmergency, user.phone]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeAlert?.updates]);

  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          const lock = await (navigator as any).wakeLock.request('screen');
          setWakeLock(lock);
        } catch (err) {}
      }
    };
    if (settings.isListening || isEmergency) requestWakeLock();
    else if (wakeLock) {
      wakeLock.release().then(() => setWakeLock(null));
    }
  }, [settings.isListening, isEmergency]);

  useEffect(() => {
    if (settings.isListening || isEmergency) {
      // FIX TS7006: Explicitly typing the parameters
      watchIdRef.current = startLocationTracking(
        (coords: LocationCoords) => {
          setCurrentCoords(coords);
          setError(null);
          
          if (isEmergency && activeAlert) {
            update(ref(rtdb, `alerts/${activeAlert.id}`), {
              location: { lat: coords.lat, lng: coords.lng }
            });
            // Update live_locations node for simpler dashboard tracking
            set(ref(rtdb, `live_locations/${user.id}`), {
              lat: coords.lat,
              lng: coords.lng,
              timestamp: Date.now()
            });
          }
        },
        (errMessage: string) => setError(errMessage)
      );
    } else {
      stopLocationTracking(watchIdRef.current);
      watchIdRef.current = -1;
    }
    return () => stopLocationTracking(watchIdRef.current);
  }, [settings.isListening, isEmergency, user.phone, activeAlert]);

  const triggerAlert = async (manual = false) => {
    if (registeredContacts.length === 0) {
      setError("Shield Offline: No verified Guardians linked. Update mesh links in Config.");
      return;
    }

    const startAlert = async (loc: {lat: number, lng: number} | null) => {
      const alertId = Date.now().toString();
      const newLog: AlertLog = {
        id: alertId,
        senderPhone: user.phone,
        senderName: user.name,
        timestamp: Date.now(),
        location: loc,
        message: manual ? "🚨 MANUAL SOS TRIGGERED 🚨" : "🚨 VOICE ACTIVATED ALERT 🚨",
        updates: [],
        isLive: true,
        recipients: registeredContacts.map(c => c.phone)
      };

      await set(ref(rtdb, `alerts/${alertId}`), newLog);
      onAlertTriggered(newLog);
      setActiveAlert(newLog);
      setError(null);
    };

    if (currentCoords) {
      startAlert({ lat: currentCoords.lat, lng: currentCoords.lng });
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => startAlert({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => startAlert(null),
        { enableHighAccuracy: true }
      );
    }
  };

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !activeAlert) return;

    const msg: ChatMessage = {
      id: Date.now().toString(),
      senderName: user.name,
      senderPhone: user.phone,
      text: chatMessage,
      timestamp: Date.now(),
      location: currentCoords ? { lat: currentCoords.lat, lng: currentCoords.lng } : undefined
    };

    const updatesRef = ref(rtdb, `alerts/${activeAlert.id}/updates`);
    const newMessageRef = push(updatesRef);
    await set(newMessageRef, msg);
    setChatMessage('');
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
        onAlert: () => triggerAlert(false),
        onError: (err) => { setError(err); updateSettings({ isListening: false }); }
      });
      await monitor.start();
      monitorRef.current = monitor;
      updateSettings({ isListening: true });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className={`p-4 rounded-3xl flex items-center justify-between border ${wakeLock ? 'bg-green-500/10 border-green-500/20 text-green-500 shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
        <div className="flex items-center gap-3">
          {wakeLock ? <Lock size={14} className="animate-pulse" /> : <Unlock size={14} />}
          <span className="text-[10px] font-black uppercase tracking-widest">{wakeLock ? 'Screen Lock Active' : 'Standby Mode'}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${currentCoords ? 'bg-blue-500 animate-pulse' : 'bg-slate-700'}`} />
          <span className="text-[8px] font-black uppercase tracking-widest">{currentCoords ? 'GPS Live' : 'No Signal'}</span>
        </div>
      </div>

      {!isEmergency ? (
        <>
          <div className={`p-14 rounded-[4rem] flex flex-col items-center justify-center border-2 transition-all duration-700 ${settings.isListening ? 'bg-blue-600/5 border-blue-500/40 shadow-2xl' : 'bg-slate-900 border-slate-800 shadow-2xl'}`}>
            <button onClick={toggleListening} className={`w-44 h-44 rounded-full flex items-center justify-center transition-all ${settings.isListening ? 'bg-blue-600 shadow-[0_30px_60px_rgba(37,99,235,0.4)]' : 'bg-slate-800 shadow-inner'}`}>
              <Power size={80} className={settings.isListening ? 'text-white' : 'text-slate-600'} />
            </button>
            <div className="mt-12 text-center space-y-3">
              <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">{settings.isListening ? 'AI Guard On' : 'AI Guard Off'}</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] leading-relaxed px-6">
                {settings.isListening ? `Listening for: "${settings.triggerPhrase}"` : 'Touch icon to begin voice monitoring'}
              </p>
            </div>
          </div>

          <button 
            onClick={() => triggerAlert(true)}
            className="w-full bg-red-600 hover:bg-red-500 p-8 rounded-[3.5rem] flex items-center justify-center gap-6 shadow-2xl active:scale-95 transition-all group border-2 border-red-400/20"
          >
            <div className="bg-white/20 p-4 rounded-3xl group-hover:rotate-12 transition-transform"><ShieldAlert size={44} className="text-white" /></div>
            <div className="text-left">
              <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">Panic SOS</h3>
              <p className="text-red-100 text-[10px] font-black uppercase tracking-widest mt-1 opacity-70">Manual Mesh Activation</p>
            </div>
          </button>
        </>
      ) : (
        <div className="space-y-5 animate-in slide-in-from-bottom-10 duration-700">
          <div className="bg-red-600 p-8 rounded-[3rem] shadow-[0_40px_100px_rgba(220,38,38,0.4)] relative overflow-hidden border-2 border-red-400/30">
             <div className="flex items-center gap-5 relative z-10">
                <div className="bg-white p-4 rounded-3xl text-red-600 shadow-2xl rotate-6"><ShieldCheck size={40} /></div>
                <div className="flex-1 text-white">
                  <h4 className="font-black text-2xl italic tracking-tighter leading-tight uppercase">Emergency Active</h4>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] font-black uppercase bg-white/20 w-fit px-3 py-1 rounded-full backdrop-blur-md">
                    <Radio size={12} className="animate-pulse" /> Live Mesh Broadcast On
                  </div>
                </div>
             </div>
             <Navigation className="absolute -right-10 -bottom-10 opacity-10 rotate-12 text-white" size={180} />
          </div>

          <div className="bg-slate-900 p-7 rounded-[3.5rem] border border-slate-800 h-[520px] flex flex-col shadow-2xl">
            <div className="flex items-center gap-3 mb-6 px-2 mt-2">
               <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500 shadow-sm"><MessageCircle size={18} /></div>
               <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-500 italic">Security Comms</h5>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 px-2 custom-scrollbar">
              <div className="bg-blue-600/10 border-2 border-blue-500/10 p-5 rounded-[2rem] text-[11px] text-blue-100 italic leading-relaxed shadow-inner border-dashed">
                {activeAlert?.message}
              </div>
              {activeAlert?.updates && Object.values(activeAlert.updates).map((msg: any) => (
                <div key={msg.id} className={`max-w-[88%] p-5 rounded-[2rem] text-[13px] shadow-2xl animate-in zoom-in duration-300 ${msg.senderPhone === user.phone ? 'ml-auto bg-blue-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'}`}>
                  <div className="flex justify-between items-center mb-1.5 opacity-60 text-[8px] font-black uppercase tracking-widest">
                    <span>{msg.senderName}</span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className="font-medium leading-snug">{msg.text}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={sendChatMessage} className="mt-6 flex gap-3 relative">
              <input 
                type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} 
                placeholder="Broadcast status..." 
                className="grow bg-slate-950 border border-slate-800 rounded-[2rem] py-5 px-7 text-sm text-white font-medium focus:border-blue-500 shadow-inner outline-none transition-all" 
              />
              <button type="submit" className="p-5 bg-blue-600 text-white rounded-2xl shadow-xl hover:bg-blue-500 active:scale-95 transition-all">
                <Send size={24}/>
              </button>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-7 rounded-[2.5rem] text-red-500 text-[10px] font-black uppercase flex items-center gap-5 animate-bounce shadow-xl">
          <div className="p-3 bg-red-500/20 rounded-2xl shrink-0"><AlertCircle size={28} /></div>
          <span className="leading-tight flex-1">{error}</span>
        </div>
      )}

      {!isEmergency && (
        <div className="grid grid-cols-2 gap-5 pb-8">
          <div className="bg-slate-900 p-8 rounded-[3.5rem] border border-slate-800 h-48 flex flex-col justify-between shadow-2xl group hover:border-blue-500/30 transition-all cursor-pointer">
            <div className="p-4 bg-blue-600/10 rounded-2xl w-fit text-blue-500 group-hover:scale-110 transition-transform"><Users size={32} /></div>
            <div>
              <div className="text-5xl font-black text-white italic tracking-tighter leading-none">{registeredContacts.length}</div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 block">Mesh Guards</span>
            </div>
          </div>
          <div className="bg-slate-900 p-8 rounded-[3.5rem] border border-slate-800 h-48 flex flex-col justify-between shadow-2xl group hover:border-blue-500/30 transition-all cursor-pointer">
            <div className={`p-4 rounded-2xl w-fit ${currentCoords ? 'bg-blue-600/10 text-blue-500 animate-pulse' : 'bg-slate-800 text-slate-700'}`}><MapPin size={32} /></div>
            <div>
              <div className="text-xl font-black text-white italic leading-tight tracking-tighter truncate">{currentCoords ? 'Satellite Lock' : 'Locating...'}</div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 block">Accuracy: {currentCoords?.accuracy.toFixed(0)}m</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
