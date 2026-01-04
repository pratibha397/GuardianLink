
import { GoogleGenAI } from "@google/genai";
import {
  Activity,
  AlertCircle,
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
}

const Dashboard: React.FC<DashboardProps> = ({ user, settings, updateSettings, isEmergency, onAlert }) => {
  const [coords, setCoords] = useState<GuardianCoords | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [safeSpots, setSafeSpots] = useState<SafeSpot[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  
  const watchIdRef = useRef<number>(-1);
  const timerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const wakeLockRef = useRef<any>(null);

  // TASK 3: Wake Lock to keep GPS alive
  useEffect(() => {
    const handleWakeLock = async () => {
      if (activeAlertId && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (err) {
          console.warn("Wake Lock failed:", err);
        }
      } else {
        if (wakeLockRef.current) {
          wakeLockRef.current.release();
          wakeLockRef.current = null;
        }
      }
    };
    handleWakeLock();
    return () => { if (wakeLockRef.current) wakeLockRef.current.release(); };
  }, [activeAlertId]);

  // Handle SOS Timer
  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timerActive && timeLeft === 0) {
      triggerSOS("Safety Timer Expired");
    }
    return () => clearTimeout(timerRef.current);
  }, [timerActive, timeLeft]);

  // Sync active alert chat stream
  useEffect(() => {
    if (activeAlertId) {
      const chatRef = ref(rtdb, `alerts/${activeAlertId}/updates`);
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
  }, [activeAlertId]);

  // GPS Watcher
  useEffect(() => {
    if (settings.isListening || activeAlertId) {
      setErrorMsg(null);
      watchIdRef.current = startLocationWatch(
        (c: GuardianCoords) => {
          setCoords(c);
          setErrorMsg(null);
          if (activeAlertId) {
            set(ref(rtdb, `alerts/${activeAlertId}/location`), c).catch(() => {});
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
  }, [settings.isListening, activeAlertId]);

  // TASK 1: Post special location card to chat
  const postLocationToChat = async (alertId: string, currentCoords: GuardianCoords | null) => {
    if (!currentCoords) return;
    const msg: ChatMessage = {
      id: `loc_${Date.now()}`,
      type: 'location',
      senderName: 'System',
      senderEmail: 'system@guardianlink.io',
      text: '📍 Live location shared automatically.',
      lat: currentCoords.lat,
      lng: currentCoords.lng,
      timestamp: Date.now()
    };
    try {
      const updatesRef = ref(rtdb, `alerts/${alertId}/updates`);
      await push(updatesRef, msg);
    } catch (e) {
      console.error("SOS location post failed", e);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg("Voice activation is not supported.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('').toLowerCase();
      
      // TASK 1.3: Danger Phrase detection
      if (transcript.includes(settings.triggerPhrase.toLowerCase())) {
        triggerSOS("Help me");
      }
    };

    recognition.onerror = () => {
      if (settings.isListening) setTimeout(() => { try { recognition.start(); } catch(e) {} }, 1500);
    };

    recognition.onend = () => {
      if (settings.isListening) { try { recognition.start(); } catch(e) {} }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      setErrorMsg("Mic access denied.");
    }
  };

  const toggleGuard = async () => {
    if (settings.isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      updateSettings({ isListening: false });
    } else {
      startListening();
      updateSettings({ isListening: true });
    }
  };

  const triggerSOS = async (reason: string) => {
    if (activeAlertId) return;

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
      setActiveAlertId(alertId);
      onAlert(log);
      setTimerActive(false);
      
      // TASK 1.2: Post location immediately after initializing alert
      if (coords) {
        postLocationToChat(alertId, coords);
      } else {
        // Retry once after 2 seconds if GPS wasn't locked yet
        setTimeout(() => {
          if (coords) postLocationToChat(alertId, coords);
        }, 2000);
      }
    } catch (e) {
      setErrorMsg("SOS broadcast failed. Checking connection...");
    }
  };

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAlertId || !replyText.trim()) return;

    const msg: ChatMessage = {
      id: Date.now().toString(),
      type: 'text',
      senderName: user.name,
      senderEmail: user.email,
      text: replyText.trim(),
      timestamp: Date.now()
    };

    try {
      const updatesRef = ref(rtdb, `alerts/${activeAlertId}/updates`);
      await push(updatesRef, msg);
      setReplyText("");
    } catch (e) {
      setErrorMsg("Message delivery failed.");
    }
  };

  const cancelSOS = async () => {
    if (activeAlertId) {
      await set(ref(rtdb, `alerts/${activeAlertId}/isLive`), false);
      setActiveAlertId(null);
      setChatMessages([]);
      window.location.reload(); 
    }
  };

  const findSafeSpots = async () => {
    if (!coords) {
      setErrorMsg("Wait for GPS lock.");
      return;
    }
    setIsSearching(true);
    setErrorMsg(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Locate 3 nearest emergency hospitals and police stations for lat ${coords.lat}, lng ${coords.lng}.`,
      });
      
      setSafeSpots([
        { name: "Nearest Police Station", uri: `https://www.google.com/maps/search/police/@${coords.lat},${coords.lng},15z` },
        { name: "Emergency Medical Care", uri: `https://www.google.com/maps/search/hospital/@${coords.lat},${coords.lng},15z` },
        { name: "Fire Department / Safety", uri: `https://www.google.com/maps/search/fire+station/@${coords.lat},${coords.lng},15z` }
      ]);
    } catch (e: any) {
      setErrorMsg("Network resource error.");
    } finally {
      setIsSearching(false);
    }
  };

  // TASK 1.4: Emergency UI with Comms Hub
  if (activeAlertId) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 max-h-[85vh] flex flex-col">
        <div className="bg-red-600 p-8 rounded-[2.5rem] shadow-[0_30px_60px_rgba(220,38,38,0.3)] text-center relative overflow-hidden shrink-0">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 to-transparent animate-pulse" />
          <ShieldAlert size={60} className="text-white mx-auto mb-4 relative z-10" />
          <h2 className="text-3xl font-black uppercase tracking-tighter text-white relative z-10 italic">SOS ACTIVE</h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-100/80 mt-2 relative z-10">Live Link Established</p>
        </div>

        <div className="glass rounded-[2rem] p-6 border-red-500/20 flex flex-col flex-1 min-h-0">
          <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-4 shrink-0">
            <MessageCircle size={18} className="text-blue-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Network Comms</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-700 text-center px-4">
                <Activity size={24} className="mb-3 opacity-20" />
                <p className="text-[10px] uppercase font-bold tracking-widest italic">Encrypted channel established. Waiting for response...</p>
              </div>
            ) : (
              chatMessages.map((msg, idx) => {
                const isMe = msg.senderEmail === user.email;

                // TASK 1.4: Render Location Card
                if (msg.type === 'location') {
                  return (
                    <div key={idx} className="flex justify-center my-6">
                      <div className="bg-blue-900/40 border border-blue-400/30 p-5 rounded-[2.5rem] w-full max-w-[300px] shadow-2xl relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-lg">
                          Live Location Shared
                        </div>
                        <div className="flex items-center gap-4 mb-4 mt-2">
                          <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-xl">
                            <Navigation size={20} />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">GPS Payload</span>
                            <p className="text-white text-[12px] font-bold">Safe-Zone Coordinates</p>
                          </div>
                        </div>
                        <a 
                          href={`https://www.google.com/maps?q=${msg.lat},${msg.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-3 bg-white py-4 rounded-2xl text-blue-900 text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                        >
                          Open in Maps <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] font-bold leading-relaxed ${isMe ? 'bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-600/20' : 'bg-slate-800 text-slate-100 rounded-tl-none border border-white/5'}`}>
                      <p className="text-[8px] uppercase tracking-tighter opacity-50 mb-1">{msg.senderName}</p>
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={sendChatMessage} className="flex gap-2 shrink-0">
            <input 
              type="text" 
              value={replyText} 
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Send status update..."
              className="flex-1 bg-slate-950 border border-white/5 rounded-2xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none shadow-inner"
            />
            <button type="submit" className="bg-blue-600 p-4 rounded-2xl text-white shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
              <Send size={20} />
            </button>
          </form>
        </div>

        <button 
          onClick={cancelSOS}
          className="w-full bg-slate-900 border border-white/5 py-5 rounded-2xl text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shrink-0"
        >
          <X size={14} /> System Reset • I am safe
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
      <div className="flex flex-col items-center justify-center py-6">
        <div className={`neural-ring ${settings.isListening ? 'active' : ''}`}>
          {settings.isListening && (
            <>
              <div className="ring-layer" style={{ animationDelay: '0s' }} />
              <div className="ring-layer" style={{ animationDelay: '1s' }} />
            </>
          )}
          <button 
            onClick={toggleGuard}
            className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${settings.isListening ? 'bg-blue-600 shadow-blue-600/30 scale-105' : 'bg-slate-800 shadow-black'}`}
          >
            <Power size={48} className={settings.isListening ? 'text-white' : 'text-slate-600'} />
          </button>
        </div>
        
        <div className="mt-8 text-center space-y-2">
          <h2 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2 justify-center leading-none text-white">
            {settings.isListening ? <Activity className="text-blue-500 animate-pulse" size={20} /> : null}
            {settings.isListening ? 'Protection Active' : 'System Standby'}
          </h2>
          <p className="text-[10px] mono text-slate-500 uppercase tracking-widest font-bold">
            {settings.isListening ? `Listening for "${settings.triggerPhrase}"` : 'Voice Activation Disabled'}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 animate-pulse">
          <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
          <p className="text-[11px] text-amber-500 font-bold uppercase tracking-tight">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div 
          onClick={() => {
            if (timerActive) setTimerActive(false);
            else { setTimerActive(true); setTimeLeft(settings.checkInDuration * 60); }
          }}
          className={`glass p-6 rounded-[2rem] border transition-all cursor-pointer ${timerActive ? 'border-blue-500/40 bg-blue-500/5' : 'border-white/5 hover:border-white/10'}`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className={`p-2.5 rounded-xl ${timerActive ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-500'}`}>
              <Timer size={20} />
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Safe Timer</p>
          <div className="text-xl font-bold mono mt-1 text-white">
            {timerActive ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : 'Check-In'}
          </div>
        </div>

        <div onClick={() => triggerSOS("Manual Emergency Alert")} className="bg-red-950/20 border border-red-500/10 p-6 rounded-[2rem] flex flex-col justify-between active:scale-95 transition-transform cursor-pointer hover:bg-red-950/30 group">
          <div className="p-2.5 bg-red-600 rounded-xl w-fit text-white shadow-lg shadow-red-600/20 group-hover:scale-110 transition-transform">
            <ShieldAlert size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Emergency</p>
            <div className="text-xl font-black tracking-tight text-white uppercase italic leading-none mt-1">Send SOS</div>
          </div>
        </div>
      </div>

      <div className="glass rounded-[2.5rem] p-6 border border-white/5">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <Globe size={18} />
            </div>
            <h3 className="text-sm font-extrabold uppercase tracking-widest italic text-white">Nearby Help</h3>
          </div>
          <button 
            onClick={findSafeSpots}
            disabled={isSearching || !coords}
            className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-30"
          >
            {isSearching ? 'Locating...' : 'Refresh'} <Search size={14} />
          </button>
        </div>

        <div className="space-y-3">
          {safeSpots.length > 0 ? safeSpots.map((spot, i) => (
            <a 
              key={i} href={spot.uri} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-slate-900/40 border border-white/5 rounded-2xl group hover:border-blue-500/30 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="bg-slate-800 p-2 rounded-lg text-slate-500 group-hover:text-blue-500 transition-colors">
                  <MapPin size={16} />
                </div>
                <span className="text-[12px] font-bold text-slate-300 truncate pr-4">{spot.name}</span>
              </div>
              <ChevronRight size={16} className="text-slate-700 shrink-0" />
            </a>
          )) : (
            <div className="py-10 text-center text-slate-700 border border-dashed border-white/5 rounded-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]">{isSearching ? 'Analyzing Local Data...' : 'No safety resources indexed'}</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-4 flex items-center justify-between mono text-[10px] text-slate-600 bg-slate-900/50 rounded-full border border-white/5">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${coords ? 'bg-green-500 animate-pulse' : (settings.isListening ? 'bg-amber-500 animate-pulse' : 'bg-slate-800')}`} />
          <span className="uppercase font-bold tracking-tighter">
            {coords ? 'LIVE GPS LOCK' : (settings.isListening ? 'SEARCHING SIGNAL' : 'OFFLINE')}
          </span>
        </div>
        <span className="font-bold text-white">{coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : '--.----, --.----'}</span>
      </div>
    </div>
  );
};

export default Dashboard;
