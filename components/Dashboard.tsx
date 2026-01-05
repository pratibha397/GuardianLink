
import { GoogleGenAI } from "@google/genai";
import {
  Activity,
  ChevronRight,
  Globe,
  MessageCircle,
  Power,
  Send,
  ShieldAlert,
  Timer,
  Wifi,
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
  
  // Messenger States
  const [meshMessages, setMeshMessages] = useState<ChatMessage[]>([]);
  const [emergencyMessages, setEmergencyMessages] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  
  const watchIdRef = useRef<number>(-1);
  const timerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const meshChatEndRef = useRef<HTMLDivElement>(null);

  // Helper for location sharing
  const pushLocationToChat = async (targetPath: string, currentCoords: GuardianCoords | null) => {
    if (!currentCoords) return;
    const msg: ChatMessage = {
      id: `loc_${Date.now()}`,
      type: 'location',
      senderName: user.name,
      senderEmail: user.email,
      text: '📍 Live location shared.',
      lat: currentCoords.lat,
      lng: currentCoords.lng,
      timestamp: Date.now()
    };
    try {
      await push(ref(rtdb, `${targetPath}/updates`), msg);
    } catch (e) { console.error(e); }
  };

  // 1. PERSISTENT 2-WAY COMMUNICATION (Mesh Messenger)
  useEffect(() => {
    const meshId = user.id; // Persistent mesh path for this user's network
    const meshRef = ref(rtdb, `mesh_chats/${meshId}/updates`);
    const unsubscribe = onValue(meshRef, (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (data) {
        const sorted = Object.values(data).sort((a: any, b: any) => a.timestamp - b.timestamp) as ChatMessage[];
        setMeshMessages(sorted);
        setTimeout(() => meshChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    });
    return () => unsubscribe();
  }, [user.id]);

  // 2. EMERGENCY COMMS SYNC
  useEffect(() => {
    if (externalActiveAlertId) {
      const chatRef = ref(rtdb, `alerts/${externalActiveAlertId}/updates`);
      const unsubscribe = onValue(chatRef, (snapshot: DataSnapshot) => {
        const data = snapshot.val();
        if (data) {
          const sorted = Object.values(data).sort((a: any, b: any) => a.timestamp - b.timestamp) as ChatMessage[];
          setEmergencyMessages(sorted);
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      });
      return () => unsubscribe();
    }
  }, [externalActiveAlertId]);

  // GPS & Voice Trigger Logic
  useEffect(() => {
    if (settings.isListening || externalActiveAlertId) {
      watchIdRef.current = startLocationWatch(
        (c: GuardianCoords) => {
          setCoords(c);
          if (externalActiveAlertId) set(ref(rtdb, `alerts/${externalActiveAlertId}/location`), c).catch(() => {});
        },
        (err: string) => setErrorMsg(err)
      );
    } else {
      if (watchIdRef.current !== -1) stopLocationWatch(watchIdRef.current);
    }
    return () => stopLocationWatch(watchIdRef.current);
  }, [settings.isListening, externalActiveAlertId]);

  const triggerSOS = async (reason: string) => {
    if (externalActiveAlertId) return;
    const alertId = `alert_${user.id}_${Date.now()}`;
    const log: AlertLog = {
      id: alertId, senderEmail: user.email, senderName: user.name,
      timestamp: Date.now(), location: coords, message: reason,
      isLive: true, recipients: settings.contacts.map(c => c.email)
    };
    try {
      await set(ref(rtdb, `alerts/${alertId}`), log);
      onAlert(log);
      setTimerActive(false);
      if (coords) pushLocationToChat(`alerts/${alertId}`, coords);
    } catch (e) { setErrorMsg("SOS Link Failed."); }
  };

  const sendMeshMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    const path = externalActiveAlertId ? `alerts/${externalActiveAlertId}` : `mesh_chats/${user.id}`;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      senderName: user.name,
      senderEmail: user.email,
      text: replyText.trim(),
      timestamp: Date.now()
    };
    try {
      await push(ref(rtdb, `${path}/updates`), msg);
      setReplyText("");
    } catch (e) { setErrorMsg("Comms error."); }
  };

  const toggleGuard = () => {
    if (settings.isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      updateSettings({ isListening: false });
    } else {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const recognition = new SR();
        recognition.continuous = true;
        recognition.onresult = (e: any) => {
          const t = Array.from(e.results).map((r: any) => r[0].transcript).join('').toLowerCase();
          if (t.includes(settings.triggerPhrase.toLowerCase())) triggerSOS("Voice Alert");
        };
        recognition.start();
        recognitionRef.current = recognition;
      }
      updateSettings({ isListening: true });
    }
  };

  // Optimized to use Google Maps grounding as per senior engineer guidelines
  const findSafeSpots = async () => {
    if (!coords) return;
    setIsSearching(true);
    setErrorMsg(null);
    try {
      // Re-initialize for each call to ensure fresh context and API key usage
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Locate safety zones such as police stations, hospitals, and emergency shelters near latitude ${coords.lat}, longitude ${coords.lng}.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: coords.lat,
                longitude: coords.lng
              }
            }
          }
        },
      });

      // Extract specific grounding chunks for maps as required by the guidelines
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const extractedSpots: SafeSpot[] = chunks
        .filter((chunk: any) => chunk.maps)
        .map((chunk: any) => ({
          name: chunk.maps.title || "Safe Zone",
          uri: chunk.maps.uri
        }));

      if (extractedSpots.length > 0) {
        setSafeSpots(extractedSpots);
      } else {
        // Fallback to manual search if no grounding chunks are returned
        setSafeSpots([
          { name: "Police Station", uri: `https://www.google.com/maps/search/police/@${coords.lat},${coords.lng},15z` }, 
          { name: "Hospital", uri: `https://www.google.com/maps/search/hospital/@${coords.lat},${coords.lng},15z` }
        ]);
      }
    } catch (err) {
      console.error("Grounding scan failed:", err);
      setErrorMsg("Failed to scan for safety nodes.");
    } finally { setIsSearching(false); }
  };

  // UI FOR EMERGENCY STATE
  if (externalActiveAlertId) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 flex flex-col h-[80vh]">
        <div className="bg-red-600 p-6 rounded-[2.5rem] shadow-2xl text-center relative shrink-0">
          <ShieldAlert size={40} className="text-white mx-auto mb-2" />
          <h2 className="text-xl font-black uppercase text-white italic">SOS Active</h2>
          <p className="text-[9px] font-bold text-red-100 uppercase tracking-widest">Two-Way Mesh Comms Established</p>
        </div>

        <div className="glass rounded-[2rem] p-5 flex flex-col flex-1 min-h-0 border-red-500/20 shadow-2xl">
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
             <div className="flex items-center gap-2">
               <Activity size={16} className="text-red-500 animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Emergency Feed</span>
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 custom-scrollbar">
            {emergencyMessages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.senderEmail === user.email ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-3xl text-[12px] font-bold ${msg.senderEmail === user.email ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-100 rounded-tl-none border border-white/5'}`}>
                  {! (msg.senderEmail === user.email) && <p className="text-[8px] font-black uppercase opacity-50 mb-1">{msg.senderName}</p>}
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={sendMeshMessage} className="flex gap-2 shrink-0 pt-3 border-t border-white/5">
            <input 
              type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)}
              placeholder="Report status to guardians..."
              className="flex-1 bg-slate-950 border border-white/5 rounded-2xl px-5 py-4 text-sm text-white focus:border-red-500 outline-none"
            />
            <button type="submit" className="bg-red-600 p-4 rounded-2xl text-white shadow-xl active:scale-95 transition-all">
              <Send size={20} />
            </button>
          </form>
        </div>

        <button 
          onClick={() => { onClearAlert(); window.location.reload(); }}
          className="w-full bg-slate-900 border border-white/10 py-5 rounded-[2rem] text-slate-500 font-black uppercase tracking-widest text-[10px] hover:bg-slate-800"
        >
          <X size={14} className="inline mr-2" /> Signal Safety • End SOS
        </button>
      </div>
    );
  }

  // STANDARD UI (WITH PERSISTENT CHATBOX)
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700 pb-10">
      <div className="flex flex-col items-center justify-center py-4">
        <div className={`neural-ring ${settings.isListening ? 'active' : ''}`}>
          {settings.isListening && <><div className="ring-layer" /><div className="ring-layer" style={{animationDelay: '1s'}}/></>}
          <button onClick={toggleGuard} className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all ${settings.isListening ? 'bg-blue-600 shadow-blue-600/40' : 'bg-slate-800'}`}>
            <Power size={40} className={settings.isListening ? 'text-white' : 'text-slate-600'} />
          </button>
        </div>
        <div className="mt-6 text-center">
          <h2 className="text-xl font-black uppercase text-white tracking-tight">{settings.isListening ? 'Mesh Active' : 'Standby'}</h2>
          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest italic mt-1">{settings.isListening ? `Voice Trigger Enabled` : 'Tap to start monitoring'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass p-5 rounded-[2rem] border border-white/5">
          <Timer size={18} className="text-blue-500 mb-3" />
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Safety Timer</p>
          <div className="text-lg font-black text-white mt-1">Check-In</div>
        </div>
        <div onClick={() => triggerSOS("Manual Alert")} className="bg-red-950/20 border border-red-500/20 p-5 rounded-[2rem] cursor-pointer active:scale-95 transition-all">
          <ShieldAlert size={18} className="text-red-500 mb-3" />
          <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest">Emergency</p>
          <div className="text-lg font-black text-white uppercase italic mt-1">SOS Alert</div>
        </div>
      </div>

      {/* PERSISTENT 2-WAY MESH MESSENGER */}
      <div className="glass rounded-[2.5rem] border border-white/5 flex flex-col h-[380px] shadow-2xl">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500">
              <MessageCircle size={18} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest italic text-white">Mesh Messenger</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[8px] font-black uppercase text-slate-500 tracking-tighter">Live Comms</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {meshMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10 italic text-center">
              <Wifi size={24} className="mb-2" />
              <p className="text-[9px] uppercase font-black tracking-widest">Secure Mesh Established.<br/>Send a message to guardians.</p>
            </div>
          ) : (
            meshMessages.map((msg, idx) => {
              const isMe = msg.senderEmail === user.email;
              return (
                <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] p-3.5 rounded-[1.5rem] text-[12px] font-bold shadow-lg ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-100 rounded-tl-none border border-white/5'}`}>
                    {!isMe && <p className="text-[7px] font-black uppercase text-blue-400 mb-1">{msg.senderName}</p>}
                    {msg.text}
                  </div>
                  <span className="text-[6px] font-black text-slate-700 uppercase mt-1 px-2">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              );
            })
          )}
          <div ref={meshChatEndRef} />
        </div>

        <form onSubmit={sendMeshMessage} className="p-4 bg-slate-950/50 border-t border-white/5 flex gap-2">
          <input 
            type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)}
            placeholder="Talk to guardians..."
            className="flex-1 bg-slate-950 border border-white/5 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-blue-500"
          />
          <button type="submit" className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg active:scale-95 transition-all">
            <Send size={18} />
          </button>
        </form>
      </div>

      <div className="glass rounded-[2rem] p-6 border border-white/5">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xs font-black uppercase tracking-widest italic text-white flex items-center gap-2">
            <Globe size={16} className="text-blue-500" /> Nearby nodes
          </h3>
          <button onClick={findSafeSpots} className="text-[9px] font-black text-blue-500 uppercase">Scan</button>
        </div>
        <div className="space-y-3">
          {safeSpots.map((spot, i) => (
            <a key={i} href={spot.uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-white/5">
              <span className="text-[11px] font-bold text-slate-400">{spot.name}</span>
              <ChevronRight size={14} className="text-slate-700" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
