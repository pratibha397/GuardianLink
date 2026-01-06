
import { GoogleGenAI } from "@google/genai";
import {
  Activity,
  ChevronRight,
  ExternalLink,
  Globe,
  Navigation,
  Power,
  ShieldAlert,
  Timer,
  X
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { getPreciseCurrentPosition, startLocationWatch, stopLocationWatch } from '../services/LocationServices';
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
  const [safeSpots, setSafeSpots] = useState<SafeSpot[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const watchIdRef = useRef<number>(-1);
  const recognitionRef = useRef<any>(null);
  const isTriggeringRef = useRef(false);

  /**
   * Explicitly requests microphone and location permissions to prevent silent failures.
   */
  const requestCorePermissions = async (): Promise<boolean> => {
    try {
      // Microphone request
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Location request (explicitly using small timeout to force a prompt)
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          (err) => {
            console.warn("Location prompt result:", err);
            resolve(err.code !== err.PERMISSION_DENIED);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      });
    } catch (e) {
      console.warn("Permission request failed:", e);
      return false;
    }
  };

  const sendLocationDirect = async (preciseCoords: GuardianCoords) => {
    if (!settings.primaryGuardianEmail) return;

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
      text: '🚨 PANIC DETECTED: AUTO-LOC DISPATCHED 🚨',
      lat: preciseCoords.lat,
      lng: preciseCoords.lng,
      timestamp: Date.now()
    };

    try {
      await push(ref(rtdb, `${path}/updates`), msg);
    } catch (e) {
      console.error("Direct alert dispatch failed!", e);
    }
  };

  const pushLocationToChat = async (targetPath: string, currentCoords: GuardianCoords) => {
    const msg: ChatMessage = {
      id: `loc_${Date.now()}`,
      type: 'location',
      senderName: user.name,
      senderEmail: user.email,
      text: '📍 Emergency GPS Tracking Active.',
      lat: currentCoords.lat,
      lng: currentCoords.lng,
      timestamp: Date.now()
    };
    try {
      await push(ref(rtdb, `${targetPath}/updates`), msg);
    } catch (e) { console.error(e); }
  };

  // Main system loop for GPS and Voice Recognition
  useEffect(() => {
    // Start standard GPS watch
    watchIdRef.current = startLocationWatch(
      (c: GuardianCoords) => {
        setCoords(c);
        if (externalActiveAlertId) {
          set(ref(rtdb, `alerts/${externalActiveAlertId}/location`), c).catch(() => {});
        }
      },
      (err: string) => setErrorMsg(err)
    );

    // Initialize Speech Recognition Engine
    if (settings.isListening && !externalActiveAlertId) {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = ''; // Let browser auto-detect language

        recognition.onresult = (e: any) => {
          if (isTriggeringRef.current) return;
          
          const transcript = Array.from(e.results)
            .map((r: any) => r[0].transcript)
            .join(' ').toLowerCase();

          const trigger = settings.triggerPhrase.toLowerCase().trim();
          if (transcript.includes(trigger)) {
            isTriggeringRef.current = true;
            triggerSOS(`Voice Activated: "${trigger}"`);
            recognition.stop();
          }
        };

        recognition.onend = () => {
          // Robust auto-restart if still listening and not in emergency
          if (settings.isListening && !externalActiveAlertId && !isTriggeringRef.current) {
            try { recognition.start(); } catch(e) { console.warn("Recognition restart failed", e); }
          }
        };

        recognition.onerror = (e: any) => {
          console.error("Voice Listener Error:", e.error);
          if (e.error === 'not-allowed') {
            setErrorMsg("Microphone permission denied.");
            updateSettings({ isListening: false });
          }
        };

        try { 
          recognition.start();
          recognitionRef.current = recognition;
        } catch(e) { console.error("Could not start recognition engine", e); }
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

  /**
   * Dispatches emergency alert. Force-fetches fresh GPS signal.
   */
  const triggerSOS = async (reason: string) => {
    if (externalActiveAlertId) return;

    // Force high-accuracy fresh GPS lock
    let finalCoords = coords;
    try {
      const fresh = await getPreciseCurrentPosition();
      finalCoords = fresh;
      setCoords(fresh);
    } catch (e) {
      console.warn("Could not get fresh fix, falling back to last signal.", e);
    }

    const alertId = `alert_${user.id}_${Date.now()}`;
    const log: AlertLog = {
      id: alertId, 
      senderEmail: user.email, 
      senderName: user.name,
      timestamp: Date.now(), 
      location: finalCoords, 
      message: reason,
      isLive: true, 
      recipients: (settings.contacts || []).map(c => c.email)
    };

    try {
      await set(ref(rtdb, `alerts/${alertId}`), log);
      onAlert(log);
      
      if (finalCoords) {
        await pushLocationToChat(`alerts/${alertId}`, finalCoords);
        if (settings.primaryGuardianEmail) {
          await sendLocationDirect(finalCoords);
        }
      }
    } catch (e) { 
      setErrorMsg("Alert sync failed. Verify internet connection."); 
      isTriggeringRef.current = false;
    }
  };

  const toggleGuard = async () => {
    if (!settings.isListening) {
      const granted = await requestCorePermissions();
      if (!granted) {
        setErrorMsg("Safety features require GPS and Microphone access.");
        return;
      }
    }
    updateSettings({ isListening: !settings.isListening });
  };

  /**
   * Scans for safe zones using Gemini grounding. 
   * Handled with silent fallbacks to prevent Dashboard crashes.
   */
  const findSafeSpots = async () => {
    if (!coords) {
      setErrorMsg("GPS lock required for safety scan.");
      return;
    }
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
        { name: "Police Node", uri: `https://www.google.com/maps/search/police/@${coords.lat},${coords.lng},15z` }, 
        { name: "Medical Node", uri: `https://www.google.com/maps/search/hospital/@${coords.lat},${coords.lng},15z` }
      ]);
    } catch (err) {
      // SILENT FALLBACK to prevent blocking the UI
      console.warn("Safety node scan interrupted. Using standard GPS results.");
      setSafeSpots([
        { name: "Nearest Police", uri: `https://www.google.com/maps/search/police/@${coords.lat},${coords.lng},15z` },
        { name: "Nearest Hospital", uri: `https://www.google.com/maps/search/hospital/@${coords.lat},${coords.lng},15z` }
      ]);
    } finally { setIsSearching(false); }
  };

  if (externalActiveAlertId) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-red-600 p-8 rounded-full shadow-2xl animate-pulse mb-6">
          <ShieldAlert size={60} className="text-white" />
        </div>
        <h2 className="text-3xl font-black uppercase text-white italic tracking-tighter">Emergency Alert Live</h2>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs max-w-xs">Broadcasting coordinates to guardians. Messenger War Room open.</p>
        
        <div className="mt-10 p-6 glass rounded-[2.5rem] w-full border-red-500/20">
          <div className="flex items-center gap-4 text-left">
             <Activity className="text-red-500" />
             <div>
               <p className="text-[10px] font-black uppercase text-slate-500">Broadcasting To</p>
               <p className="text-sm font-bold text-white">{(settings.contacts || []).length} Safety Nodes</p>
             </div>
          </div>
        </div>

        <button 
          onClick={() => { onClearAlert(); window.location.reload(); }}
          className="mt-8 bg-slate-900 border border-white/10 px-8 py-4 rounded-full text-red-500 font-black uppercase tracking-widest text-[10px] hover:bg-slate-800"
        >
          <X size={14} className="inline mr-2" /> Deactivate SOS
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
          <h2 className="text-xl font-black uppercase text-white tracking-tight">{settings.isListening ? 'Guard Active' : 'Standby'}</h2>
          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest italic mt-1">{settings.isListening ? `Trigger: "${settings.triggerPhrase}"` : 'Tap to start Aegis protection'}</p>
        </div>
      </div>

      <div className="glass p-5 rounded-[2.5rem] border border-white/5 relative overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between mb-5">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500">
                 <Navigation size={18} />
              </div>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Satellite Link</h3>
                <div className="flex items-center gap-2 mt-0.5">
                   <div className={`w-1.5 h-1.5 rounded-full ${coords ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                      {coords ? 'High-Accuracy Satellite Lock' : 'Searching for Satellites...'}
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
          <div className="text-lg font-black text-white uppercase italic mt-1">Trigger SOS</div>
        </div>
      </div>

      <div className="glass rounded-[2rem] p-6 border border-white/5">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xs font-black uppercase tracking-widest italic text-white flex items-center gap-2">
            <Globe size={16} className="text-blue-500" /> Nearby Safety
          </h3>
          <button onClick={findSafeSpots} disabled={isSearching} className="text-[9px] font-black text-blue-500 uppercase disabled:opacity-30">
            {isSearching ? 'Scanning...' : 'Scan Area'}
          </button>
        </div>
        <div className="space-y-3">
          {safeSpots.map((spot, i) => (
            <a key={i} href={spot.uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-white/5">
              <span className="text-[11px] font-bold text-slate-400">{spot.name}</span>
              <ChevronRight size={14} className="text-slate-700" />
            </a>
          ))}
          {safeSpots.length === 0 && <p className="text-center text-[9px] text-slate-600 uppercase font-black py-4">No localized safety zones found</p>}
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
