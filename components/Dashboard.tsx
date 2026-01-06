
import { GoogleGenAI } from "@google/genai";
import {
  Activity,
  ChevronRight,
  ExternalLink,
  Globe,
  MapPin,
  Navigation,
  Power,
  ShieldAlert,
  Timer,
  X
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { startLocationWatch, stopLocationWatch } from '../services/LocationServices';
import { push, ref, rtdb, set } from '../services/firebase';
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
  
  const watchIdRef = useRef<number>(-1);
  const recognitionRef = useRef<any>(null);

  // Helper for direct location dispatch to primary guardian
  const sendLocationDirect = async (currentCoords: GuardianCoords | null) => {
    if (!currentCoords || !settings.primaryGuardianEmail) return;

    // Use deterministic path generation
    const email1 = user.email.toLowerCase().trim();
    const email2 = settings.primaryGuardianEmail.toLowerCase().trim();
    const sorted = [email1, email2].sort();
    const sanitize = (e: string) => e.replace(/[\.\#\$\/\[\]]/g, '_');
    const path = `direct_chats/${sanitize(sorted[0])}__${sanitize(sorted[1])}`;

    const msg: ChatMessage = {
      id: `panic_loc_${Date.now()}`,
      type: 'location',
      senderName: user.name,
      senderEmail: user.email,
      text: '🚨 VOICE TRIGGERED EMERGENCY LOCATION 🚨',
      lat: currentCoords.lat,
      lng: currentCoords.lng,
      timestamp: Date.now()
    };

    try {
      await push(ref(rtdb, `${path}/updates`), msg);
    } catch (e) {
      console.error("Direct alert dispatch failed:", e);
    }
  };

  const pushLocationToChat = async (targetPath: string, currentCoords: GuardianCoords | null) => {
    if (!currentCoords) return;
    const msg: ChatMessage = {
      id: `loc_${Date.now()}`,
      type: 'location',
      senderName: user.name,
      senderEmail: user.email,
      text: '📍 Automatic Emergency Location shared.',
      lat: currentCoords.lat,
      lng: currentCoords.lng,
      timestamp: Date.now()
    };
    try {
      await push(ref(rtdb, `${targetPath}/updates`), msg);
    } catch (e) { console.error(e); }
  };

  // GPS & Enhanced Voice Trigger Logic
  useEffect(() => {
    watchIdRef.current = startLocationWatch(
      (c: GuardianCoords) => {
        setCoords(c);
        if (externalActiveAlertId) {
          set(ref(rtdb, `alerts/${externalActiveAlertId}/location`), c).catch(() => {});
        }
      },
      (err: string) => setErrorMsg(err)
    );

    if (settings.isListening) {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR && !recognitionRef.current) {
        const recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true; // Crucial for faster detection
        recognition.lang = ''; // Let the browser handle auto-detection where possible
        
        recognition.onresult = (e: any) => {
          const results = Array.from(e.results);
          // Aggregate all interim and final results into a single scan string
          const transcript = results
            .map((r: any) => r[0].transcript)
            .join(' ')
            .toLowerCase();

          const trigger = settings.triggerPhrase.toLowerCase();
          
          if (transcript.includes(trigger)) {
            triggerSOS(`Voice Triggered: "${trigger}"`);
            // Clear recognition to prevent multiple triggers in one breath
            recognition.stop();
          }
        };

        recognition.onend = () => {
          // Auto-restart to maintain persistent mesh listening
          if (settings.isListening && !externalActiveAlertId) {
            try { recognition.start(); } catch(e) {}
          }
        };

        try { recognition.start(); } catch(e) {}
        recognitionRef.current = recognition;
      }
    } else if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    return () => {
      if (watchIdRef.current !== -1) stopLocationWatch(watchIdRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [settings.isListening, externalActiveAlertId, settings.triggerPhrase]);

  const triggerSOS = async (reason: string) => {
    if (externalActiveAlertId) return;
    const alertId = `alert_${user.id}_${Date.now()}`;
    const log: AlertLog = {
      id: alertId, senderEmail: user.email, senderName: user.name,
      timestamp: Date.now(), location: coords, message: reason,
      isLive: true, recipients: settings.contacts.map(c => c.email)
    };
    try {
      // 1. Log to global alerts node
      await set(ref(rtdb, `alerts/${alertId}`), log);
      onAlert(log);
      setTimerActive(false);

      // 2. Push to emergency war room chat
      if (coords) {
        await pushLocationToChat(`alerts/${alertId}`, coords);
        // 3. Automated targeted alert to the Primary Guardian
        if (settings.primaryGuardianEmail) {
          await sendLocationDirect(coords);
        }
      }
    } catch (e) { setErrorMsg("SOS Link Failed."); }
  };

  const toggleGuard = () => {
    updateSettings({ isListening: !settings.isListening });
  };

  const findSafeSpots = async () => {
    if (!coords) return;
    setIsSearching(true);
    setErrorMsg(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Locate safety zones such as police stations and hospitals near latitude ${coords.lat}, longitude ${coords.lng}.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: { latLng: { latitude: coords.lat, longitude: coords.lng } }
          }
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const extractedSpots: SafeSpot[] = chunks
        .filter((chunk: any) => chunk.maps)
        .map((chunk: any) => ({
          name: chunk.maps.title || "Safe Zone",
          uri: chunk.maps.uri
        }));

      setSafeSpots(extractedSpots.length > 0 ? extractedSpots : [
        { name: "Police Station", uri: `https://www.google.com/maps/search/police/@${coords.lat},${coords.lng},15z` }, 
        { name: "Hospital", uri: `https://www.google.com/maps/search/hospital/@${coords.lat},${coords.lng},15z` }
      ]);
    } catch (err) {
      setErrorMsg("Failed to scan for safety nodes.");
    } finally { setIsSearching(false); }
  };

  if (externalActiveAlertId) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-red-600 p-8 rounded-full shadow-2xl animate-pulse mb-6">
          <ShieldAlert size={60} className="text-white" />
        </div>
        <h2 className="text-3xl font-black uppercase text-white italic tracking-tighter">Emergency Alert Live</h2>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs max-w-xs">Your coordinates are being broadcast. Open the Messenger tab to talk to your guardians.</p>
        
        <div className="mt-10 p-6 glass rounded-[2.5rem] w-full border-red-500/20">
          <div className="flex items-center gap-4 text-left">
             <Activity className="text-red-500" />
             <div>
               <p className="text-[10px] font-black uppercase text-slate-500">Broadcasting To</p>
               <p className="text-sm font-bold text-white">{settings.contacts.length} Safety Guardians</p>
             </div>
          </div>
        </div>

        <button 
          onClick={() => { onClearAlert(); window.location.reload(); }}
          className="mt-8 bg-slate-900 border border-white/10 px-8 py-4 rounded-full text-red-500 font-black uppercase tracking-widest text-[10px] hover:bg-slate-800"
        >
          <X size={14} className="inline mr-2" /> Stop Alert
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
      <div className="flex flex-col items-center justify-center py-4">
        <div className={`neural-ring ${settings.isListening ? 'active' : ''}`}>
          {settings.isListening && <><div className="ring-layer" /><div className="ring-layer" style={{animationDelay: '1s'}}/></>}
          <button onClick={toggleGuard} className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all ${settings.isListening ? 'bg-blue-600 shadow-blue-600/40' : 'bg-slate-800'}`}>
            <Power size={40} className={settings.isListening ? 'text-white' : 'text-slate-600'} />
          </button>
        </div>
        <div className="mt-6 text-center">
          <h2 className="text-xl font-black uppercase text-white tracking-tight">{settings.isListening ? 'Mesh Active' : 'Standby'}</h2>
          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest italic mt-1">{settings.isListening ? `Listening for: "${settings.triggerPhrase}"` : 'Tap to start monitoring'}</p>
        </div>
      </div>

      <div className="glass p-5 rounded-[2.5rem] border border-white/5 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
           <MapPin size={120} />
        </div>
        <div className="flex items-center justify-between mb-5">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500">
                 <Navigation size={18} />
              </div>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Live Telemetry</h3>
                <div className="flex items-center gap-2 mt-0.5">
                   <div className={`w-1.5 h-1.5 rounded-full ${coords ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                      {coords ? 'Secure Signal Locked' : 'Searching for Satellites...'}
                   </span>
                </div>
              </div>
           </div>
           {coords && (
             <a 
               href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
               target="_blank" rel="noopener noreferrer"
               className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
             >
               <ExternalLink size={14} />
             </a>
           )}
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
              <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest block mb-1">Latitude</span>
              <span className="text-sm font-bold text-white mono">{coords ? coords.lat.toFixed(6) : '---.------'}</span>
           </div>
           <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
              <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest block mb-1">Longitude</span>
              <span className="text-sm font-bold text-white mono">{coords ? coords.lng.toFixed(6) : '---.------'}</span>
           </div>
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

      <div className="glass rounded-[2rem] p-6 border border-white/5">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xs font-black uppercase tracking-widest italic text-white flex items-center gap-2">
            <Globe size={16} className="text-blue-500" /> Nearby Safety
          </h3>
          <button onClick={findSafeSpots} disabled={isSearching} className="text-[9px] font-black text-blue-500 uppercase disabled:opacity-30">
            {isSearching ? 'Scanning...' : 'Scan'}
          </button>
        </div>
        <div className="space-y-3">
          {safeSpots.map((spot, i) => (
            <a key={i} href={spot.uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-white/5">
              <span className="text-[11px] font-bold text-slate-400">{spot.name}</span>
              <ChevronRight size={14} className="text-slate-700" />
            </a>
          ))}
          {safeSpots.length === 0 && <p className="text-center text-[9px] text-slate-600 uppercase font-black py-4">No local nodes found</p>}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[10px] font-bold text-amber-500 uppercase tracking-widest text-center animate-pulse">
           {errorMsg}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
