
import { GoogleGenAI } from "@google/genai";
import {
  Activity,
  ChevronRight,
  ExternalLink,
  Globe,
  MapPin,
  MessageCircle,
  Navigation,
  Power,
  Search,
  Send,
  ShieldAlert,
  Timer,
  X
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { startLocationWatch, stopLocationWatch } from '../services/LocationServices';
import { DataSnapshot, onValue, push, ref, rtdb, set } from '../services/firebase';
import { AlertLog, AppSettings, User as AppUser, ChatMessage, GuardianCoords, SafeSpot } from '../types';

interface DashboardProps {
  user: AppUser;
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
  isEmergency: boolean;
  onAlert: (log: AlertLog) => void;
  externalActiveAlertId: string | null;
  onClearAlert: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  user, settings, updateSettings, isEmergency, 
  onAlert, externalActiveAlertId, onClearAlert 
}) => {
  const [coords, setCoords] = useState<GuardianCoords | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [safeSpots, setSafeSpots] = useState<SafeSpot[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  
  const watchIdRef = useRef<number>(-1);
  const timerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const wakeLockRef = useRef<any>(null);

  // Helper for location sharing
  const pushLocationToChat = async (alertId: string, currentCoords: GuardianCoords | null, senderName: string = user.name) => {
    if (!currentCoords) return;
    const msg: ChatMessage = {
      id: `loc_${Date.now()}`,
      type: 'location',
      senderName: senderName,
      senderEmail: user.email,
      text: '📍 Live location payload shared.',
      lat: currentCoords.lat,
      lng: currentCoords.lng,
      timestamp: Date.now()
    };
    try {
      const updatesRef = ref(rtdb, `alerts/${alertId}/updates`);
      await push(updatesRef, msg);
    } catch (e) {
      console.error("Firebase Location post failed", e);
    }
  };

  // Trigger Emergency System
  const triggerSOS = async (reason: string) => {
    if (externalActiveAlertId) return;

    const alertId = `alert_${user.id}_${Date.now()}`;
    const log: AlertLog = {
      id: alertId,
      senderEmail: user.email,
      senderName: user.name,
      timestamp: Date.now(),
      location: coords,
      message: reason,
      isLive: true,
      recipients: settings.contacts.map(c => c.email)
    };
    
    try {
      await set(ref(rtdb, `alerts/${alertId}`), log);
      onAlert(log);
      setTimerActive(false);
      
      // SCENARIO A: Automatic location sharing on trigger
      if (coords) {
        pushLocationToChat(alertId, coords, "System Alert");
      }
    } catch (e) {
      setErrorMsg("SOS broadcast failed.");
    }
  };

  // Sync Chat & Comms
  useEffect(() => {
    if (externalActiveAlertId) {
      const chatRef = ref(rtdb, `alerts/${externalActiveAlertId}/updates`);
      const unsubscribe = onValue(chatRef, (snapshot: DataSnapshot) => {
        const data = snapshot.val();
        if (data) {
          const sorted = Object.values(data).sort((a: any, b: any) => a.timestamp - b.timestamp) as ChatMessage[];
          setChatMessages(sorted);
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      });
      return () => unsubscribe();
    }
  }, [externalActiveAlertId]);

  // GPS Handling
  useEffect(() => {
    if (settings.isListening || externalActiveAlertId) {
      setErrorMsg(null);
      watchIdRef.current = startLocationWatch(
        (c: GuardianCoords) => {
          setCoords(c);
          if (externalActiveAlertId) {
            set(ref(rtdb, `alerts/${externalActiveAlertId}/location`), c).catch(() => {});
          }
        },
        (err: string) => setErrorMsg(err)
      );
    } else {
      if (watchIdRef.current !== -1) {
        stopLocationWatch(watchIdRef.current);
        watchIdRef.current = -1;
      }
    }
    return () => stopLocationWatch(watchIdRef.current);
  }, [settings.isListening, externalActiveAlertId]);

  // Voice activation logic
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('').toLowerCase();
      
      if (transcript.includes(settings.triggerPhrase.toLowerCase())) {
        triggerSOS("Voice Activated SOS");
      }
    };

    recognition.onend = () => {
      if (settings.isListening) try { recognition.start(); } catch(e) {}
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) { setErrorMsg("Mic Access Denied."); }
  };

  const toggleGuard = () => {
    if (settings.isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      updateSettings({ isListening: false });
    } else {
      startListening();
      updateSettings({ isListening: true });
    }
  };

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!externalActiveAlertId || !replyText.trim()) return;

    const msg: ChatMessage = {
      id: Date.now().toString(),
      senderName: user.name,
      senderEmail: user.email,
      text: replyText.trim(),
      timestamp: Date.now()
    };

    try {
      const updatesRef = ref(rtdb, `alerts/${externalActiveAlertId}/updates`);
      await push(updatesRef, msg);
      setReplyText("");
    } catch (e) { setErrorMsg("Failed to send message."); }
  };

  const cancelSOS = async () => {
    if (externalActiveAlertId) {
      await set(ref(rtdb, `alerts/${externalActiveAlertId}/isLive`), false);
      onClearAlert();
      setChatMessages([]);
      window.location.reload();
    }
  };

  const findSafeSpots = async () => {
    if (!coords) return;
    setIsSearching(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Locate safety zones near ${coords.lat}, ${coords.lng}.`,
      });
      setSafeSpots([
        { name: "Police Sub-Station", uri: `https://www.google.com/maps/search/police/@${coords.lat},${coords.lng},15z` },
        { name: "Emergency Hospital", uri: `https://www.google.com/maps/search/hospital/@${coords.lat},${coords.lng},15z` }
      ]);
    } catch (e) { setErrorMsg("Safe spot lookup failed."); } finally { setIsSearching(false); }
  };

  // CHATBOX INTERFACE (Emergency Only)
  if (externalActiveAlertId) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 flex flex-col h-[78vh]">
        <div className="bg-red-600 p-6 rounded-[2.5rem] shadow-2xl text-center relative overflow-hidden shrink-0 border-b-4 border-red-800">
          <ShieldAlert size={40} className="text-white mx-auto mb-2" />
          <h2 className="text-xl font-black uppercase text-white tracking-tighter italic">SOS Active</h2>
          <p className="text-[10px] font-bold text-red-100 uppercase tracking-widest mt-1">Guardians are tracking your location</p>
        </div>

        {/* Real-time Guardian Comms (The Chatbox) */}
        <div className="glass rounded-[2.5rem] p-5 flex flex-col flex-1 min-h-0 border-blue-500/20 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3 shrink-0">
            <div className="flex items-center gap-3">
              <MessageCircle size={16} className="text-blue-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">War Room</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[8px] font-black uppercase text-slate-500">Live Connection</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 custom-scrollbar">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-700 space-y-3">
                <Activity size={24} className="opacity-20 animate-pulse" />
                <p className="text-[10px] uppercase font-bold tracking-widest text-center max-w-[180px]">Encrypted comms link established. Waiting for guardians...</p>
              </div>
            ) : (
              chatMessages.map((msg, idx) => {
                const isMe = msg.senderEmail === user.email;

                // SCENARIO B: Render Location Payload Card
                if (msg.type === 'location') {
                  return (
                    <div key={idx} className="flex justify-center my-6">
                      <div className="bg-blue-600/20 border border-blue-500/40 p-5 rounded-[2rem] w-full max-w-[280px] shadow-2xl relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-lg">
                          Live Position Payload
                        </div>
                        <div className="flex items-center gap-4 mb-4 mt-2">
                          <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-xl">
                            <Navigation size={20} />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">{msg.senderName}</span>
                            <p className="text-white text-[12px] font-bold italic">Check-in Coordinate</p>
                          </div>
                        </div>
                        <a 
                          href={`https://www.google.com/maps?q=${msg.lat},${msg.lng}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 bg-white py-4 rounded-2xl text-blue-950 text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all w-full"
                        >
                          View in Maps <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-3xl text-[13px] font-bold leading-relaxed ${isMe ? 'bg-blue-600 text-white rounded-tr-none shadow-lg' : 'bg-slate-800 text-slate-100 rounded-tl-none border border-white/5'}`}>
                      {!isMe && <p className="text-[8px] uppercase tracking-widest text-blue-400 mb-1 font-black">{msg.senderName}</p>}
                      {msg.text}
                    </div>
                    <span className="text-[7px] font-black text-slate-600 uppercase mt-1 px-2">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={sendChatMessage} className="flex gap-2 shrink-0 pt-2 border-t border-white/5 items-center">
            {/* Manual Location Share Button */}
            <button 
              type="button" 
              onClick={() => pushLocationToChat(externalActiveAlertId!, coords)}
              disabled={!coords}
              className={`p-4 rounded-2xl border transition-all ${coords ? 'bg-slate-900 border-white/10 text-blue-500 hover:bg-slate-800 active:scale-90' : 'bg-slate-950 border-white/5 text-slate-800 cursor-not-allowed'}`}
              title="Share Manual Pin"
            >
              <MapPin size={22} />
            </button>
            <input 
              type="text" 
              value={replyText} 
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type status update..."
              className="flex-1 bg-slate-950 border border-white/5 rounded-2xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none shadow-inner"
            />
            <button type="submit" className="bg-blue-600 p-4 rounded-2xl text-white shadow-xl active:scale-95 transition-all">
              <Send size={22} />
            </button>
          </form>
        </div>

        <button 
          onClick={cancelSOS}
          className="w-full bg-slate-900 border border-white/10 py-5 rounded-[2rem] text-slate-500 font-black uppercase tracking-[0.2em] text-[10px] hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shrink-0"
        >
          <X size={14} /> I am safe now • Reset System
        </button>
      </div>
    );
  }

  // STANDARD DASHBOARD (No Alert)
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
      <div className="flex flex-col items-center justify-center py-6">
        <div className={`neural-ring ${settings.isListening ? 'active' : ''}`}>
          {settings.isListening && (
            <>
              <div className="ring-layer" style={{ animationDelay: '0s' }} />
              <div className="ring-layer" style={{ animationDelay: '1.5s' }} />
            </>
          )}
          <button 
            onClick={toggleGuard}
            className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${settings.isListening ? 'bg-blue-600 scale-105 shadow-blue-600/40' : 'bg-slate-800 shadow-black'}`}
          >
            <Power size={48} className={settings.isListening ? 'text-white' : 'text-slate-600'} />
          </button>
        </div>
        <div className="mt-8 text-center space-y-2">
          <h2 className="text-2xl font-black tracking-tight uppercase text-white">
            {settings.isListening ? 'Protection Live' : 'System Secure'}
          </h2>
          <p className="text-[10px] mono text-slate-500 uppercase font-bold tracking-widest italic">
            {settings.isListening ? `Trigger: "${settings.triggerPhrase}"` : 'Guardian is offline'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div 
          onClick={() => {
            if (timerActive) setTimerActive(false);
            else { setTimerActive(true); setTimeLeft(settings.checkInDuration * 60); }
          }}
          className={`glass p-6 rounded-[2.5rem] cursor-pointer transition-all border-2 ${timerActive ? 'border-blue-500/60 bg-blue-500/10' : 'border-white/5 hover:border-white/10'}`}
        >
          <div className="p-3 bg-blue-600/10 rounded-2xl w-fit text-blue-500 mb-4 shadow-inner"><Timer size={20} /></div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Safe Timer</p>
          <div className="text-xl font-black mt-1 text-white tabular-nums">
            {timerActive ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : 'Check-In'}
          </div>
        </div>

        <div onClick={() => triggerSOS("Manual Alert")} className="bg-red-950/20 border-2 border-red-500/20 p-6 rounded-[2.5rem] active:scale-95 transition-transform cursor-pointer hover:bg-red-950/40">
          <div className="p-3 bg-red-600 rounded-2xl w-fit text-white mb-4 shadow-xl shadow-red-600/40"><ShieldAlert size={20} /></div>
          <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Immediate</p>
          <div className="text-xl font-black text-white uppercase italic leading-none mt-1">Panic Button</div>
        </div>
      </div>

      <div className="glass rounded-[2.5rem] p-6 border border-white/5 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xs font-black uppercase tracking-widest italic text-white flex items-center gap-2">
            <Globe size={16} className="text-blue-500" /> Nearby Safety
          </h3>
          <button 
            onClick={findSafeSpots}
            disabled={isSearching || !coords}
            className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-30"
          >
            {isSearching ? 'Locating...' : 'Scan'} <Search size={14} />
          </button>
        </div>
        <div className="space-y-3">
          {safeSpots.map((spot, i) => (
            <a 
              key={i} href={spot.uri} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-slate-900/50 border border-white/5 rounded-2xl group hover:border-blue-500/30 transition-all shadow-inner"
            >
              <span className="text-[12px] font-bold text-slate-300">{spot.name}</span>
              <ChevronRight size={16} className="text-slate-700 group-hover:text-blue-500 transition-colors" />
            </a>
          ))}
          {safeSpots.length === 0 && !isSearching && (
            <div className="py-8 text-center border border-dashed border-white/5 rounded-[2rem]">
              <p className="text-[10px] uppercase font-bold text-slate-700 tracking-widest">No local nodes found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
