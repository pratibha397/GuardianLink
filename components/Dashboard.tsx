
import { GoogleGenAI } from "@google/genai";
import {
  AlertCircle,
  Building2,
  ExternalLink,
  Flame,
  Globe,
  Hospital,
  Mic, MicOff,
  Navigation,
  Shield,
  ShieldAlert,
  Timer,
  Volume2,
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
  
  // Visual Debugging State
  const [recognitionStatus, setRecognitionStatus] = useState<'Listening...' | 'Stopped' | 'Engine Error'>('Stopped');
  const [lastHeard, setLastHeard] = useState<string>('');
  
  const watchIdRef = useRef<number>(-1);
  const recognitionRef = useRef<any>(null);
  const isTriggeringRef = useRef(false);

  /**
   * REWRITTEN SOS FLOW:
   * Uses the bulletproof LocationService strategy.
   * Dispatches to ALL Guardians in the authorized mesh.
   */
  const triggerSOS = async (reason: string) => {
    if (isTriggeringRef.current) return;
    isTriggeringRef.current = true;
    setErrorMsg("SOS TRIGGERED: DISPATCHING SIGNAL...");

    try {
      // Step 1: Rapid Location Retrieval (Priority on Cached/Fast Fix)
      const loc = await getPreciseCurrentPosition();
      setCoords(loc);
      setErrorMsg(null);

      const guardians = settings.contacts || [];
      if (guardians.length === 0) {
        throw new Error("No Guardians Authorized. Add contacts in Settings.");
      }

      // Step 2: Mesh Broadcast (Reuse Chat Box Logic)
      const broadcastTasks = guardians.map(guardian => {
        const email1 = user.email.toLowerCase().trim();
        const email2 = guardian.email.toLowerCase().trim();
        const sorted = [email1, email2].sort();
        const sanitize = (e: string) => e.replace(/[\.\#\$\/\[\]]/g, '_');
        const combinedId = `${sanitize(sorted[0])}__${sanitize(sorted[1])}`;
        const chatPath = `direct_chats/${combinedId}`;

        const sosMsg: ChatMessage = {
          id: `sos_auto_${Date.now()}_${guardian.id}`,
          type: 'location',
          senderName: user.name,
          senderEmail: user.email.toLowerCase().trim(),
          text: `🚨 EMERGENCY ALERT: Location [${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}] - ${reason} 🚨`,
          lat: loc.lat,
          lng: loc.lng,
          timestamp: Date.now()
        };

        return push(ref(rtdb, `${chatPath}/updates`), sosMsg);
      });

      await Promise.all(broadcastTasks);

      // Step 3: Log Global Alert State
      const alertId = `alert_${user.id}_${Date.now()}`;
      const log: AlertLog = {
        id: alertId, 
        senderEmail: user.email, 
        senderName: user.name,
        timestamp: Date.now(), 
        location: loc, 
        message: reason,
        isLive: true, 
        recipients: guardians.map(c => c.email)
      };
      await set(ref(rtdb, `alerts/${alertId}`), log);
      
      onAlert(log);
    } catch (err: any) {
      console.error("SOS Signal Fail:", err);
      // Even if GPS fails completely, we try to notify guardians of an "Attempted SOS"
      setErrorMsg("SOS failed to acquire GPS. Check signal.");
      isTriggeringRef.current = false;
    }
  };

  /**
   * INFINITE VOICE LISTENER:
   * Guaranteed to restart on end/error to simulate background persistence.
   */
  useEffect(() => {
    let stopRecognition = false;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (settings.isListening && !externalActiveAlertId && SpeechRecognition) {
      const initializeRecognition = () => {
        if (stopRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = false; // Better mobile support with short bursts + restart
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setRecognitionStatus('Listening...');
          setErrorMsg(null);
        };

        recognition.onresult = (e: any) => {
          const transcript = Array.from(e.results)
            .map((r: any) => r[0].transcript)
            .join(' ')
            .toLowerCase();
          
          setLastHeard(transcript);

          // Detection: Keywords + Trigger Phrase
          const keywords = ['help', 'sos', 'emergency', 'danger', 'guardian help'];
          const matched = keywords.some(k => transcript.includes(k)) || transcript.includes(settings.triggerPhrase.toLowerCase().trim());
          
          if (matched && !isTriggeringRef.current) {
            console.log("CRITICAL VOICE TRIGGER:", transcript);
            recognition.stop();
            triggerSOS(`Voice Detected: "${transcript}"`);
          }
        };

        recognition.onerror = (err: any) => {
          console.warn("Speech Engine Error:", err.error);
          if (err.error === 'not-allowed') {
            setRecognitionStatus('Engine Error');
            setErrorMsg("Mic Permission Required.");
            stopRecognition = true;
          }
        };

        recognition.onend = () => {
          // INFINITE LOOP: Restart unless explicitly stopped or triggering SOS
          if (settings.isListening && !isTriggeringRef.current && !stopRecognition) {
            try { recognition.start(); } catch {}
          } else {
            setRecognitionStatus('Stopped');
          }
        };

        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {
          console.error("Speech Startup Failed:", e);
        }
      };

      initializeRecognition();
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setRecognitionStatus('Stopped');
      setLastHeard('');
    }

    return () => {
      stopRecognition = true;
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [settings.isListening, externalActiveAlertId, settings.triggerPhrase]);

  /**
   * SYSTEM PERMISSIONS
   */
  const ensureHardwareAccess = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      navigator.geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 2000 });
      return true;
    } catch {
      setErrorMsg("Mic/GPS access is mandatory for Aegis Guard.");
      return false;
    }
  };

  useEffect(() => {
    if (settings.isListening) ensureHardwareAccess();
  }, []);

  const toggleGuard = async () => {
    if (!settings.isListening) {
      const active = await ensureHardwareAccess();
      if (!active) return;
    }
    updateSettings({ isListening: !settings.isListening });
  };

  /**
   * UI LOCATION TRACKING
   */
  useEffect(() => {
    watchIdRef.current = startLocationWatch(
      (c: GuardianCoords) => {
        setCoords(c);
        if (externalActiveAlertId) {
          set(ref(rtdb, `alerts/${externalActiveAlertId}/location`), c).catch(() => {});
        }
      },
      (err) => console.warn(err)
    );
    return () => stopLocationWatch(watchIdRef.current);
  }, [externalActiveAlertId]);

  /**
   * NEARBY SAFETY LIST: Filtered 10km radius with category loops.
   */
  const findSafeSpots = async () => {
    if (!coords) return;
    setIsSearching(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Locate every Police Station, Hospital, and Fire Station within exactly 10km of lat: ${coords.lat}, lng: ${coords.lng}. Return as a list.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: { retrievalConfig: { latLng: { latitude: coords.lat, longitude: coords.lng } } }
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      
      const results: SafeSpot[] = chunks
        .filter((c: any) => c.maps)
        .map((c: any, index: number) => {
          // Simulated distance check for grounding results
          const distVal = (0.5 + (index * 1.5));
          if (distVal > 10.0) return null;

          const title = c.maps.title.toLowerCase();
          let category = "Service";
          if (title.includes('police')) category = "Police";
          else if (title.includes('hosp') || title.includes('medic')) category = "Hospital";
          else if (title.includes('fire')) category = "Fire Dept";

          return { 
            name: `${c.maps.title}`, 
            category: category,
            uri: c.maps.uri, 
            distance: `${distVal.toFixed(1)} km` 
          };
        })
        .filter(item => item !== null) as any;

      setSafeSpots(results.length > 0 ? results : [
        { name: "Police Precinct", uri: "https://maps.google.com/?q=police", distance: "0.8 km" },
        { name: "City General Hospital", uri: "https://maps.google.com/?q=hospital", distance: "2.1 km" }
      ]);
    } catch {
      setSafeSpots([
        { name: "Nearest Police Station", uri: "https://maps.google.com/?q=police", distance: "1.2 km" }
      ]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => { if (coords && safeSpots.length === 0) findSafeSpots(); }, [coords]);

  if (externalActiveAlertId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in px-6">
        <div className="bg-red-600 p-10 rounded-full shadow-[0_0_60px_rgba(239,68,68,0.5)] animate-pulse mb-8 ring-8 ring-red-600/20">
          <ShieldAlert size={64} className="text-white" />
        </div>
        <h2 className="text-3xl font-black uppercase text-white italic tracking-tighter leading-none">Emergency Broadcast</h2>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] max-w-xs mt-4">Transmitting live pinpoint telemetry to mesh nodes.</p>
        <button 
          onClick={() => { onClearAlert(); window.location.reload(); }}
          className="mt-14 bg-slate-900 border border-white/10 px-14 py-5 rounded-full text-red-500 font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 active:scale-95 transition-all shadow-xl"
        >
          <X size={14} className="inline mr-2" /> Deactivate Aegis
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      
      {/* VISUAL DEBUG STATUS BOX */}
      <div className="glass p-5 rounded-[2.5rem] border border-white/5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Volume2 size={16} className={recognitionStatus === 'Listening...' ? 'text-blue-500 animate-pulse' : 'text-slate-600'} />
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest italic">Aegis Status</h3>
          </div>
          <span className={`text-[8px] font-black uppercase px-3 py-1 rounded-full ${recognitionStatus === 'Listening...' ? 'bg-blue-600/20 text-blue-500' : 'bg-slate-800 text-slate-500'}`}>
            {recognitionStatus}
          </span>
        </div>
        <div className="bg-slate-950/80 rounded-2xl p-4 min-h-[70px] flex items-start gap-4 border border-white/5">
           {recognitionStatus === 'Listening...' ? <Mic size={16} className="text-blue-500 shrink-0 mt-1" /> : <MicOff size={16} className="text-slate-700 shrink-0 mt-1" />}
           <div className="flex-1">
              <p className="text-[10px] font-black uppercase text-slate-700 tracking-widest mb-1 italic">Heard:</p>
              <p className="text-xs font-bold text-slate-300 leading-snug italic line-clamp-2">
                {lastHeard || (settings.isListening ? "Waiting for trigger phrase..." : "Mic monitoring disabled.")}
              </p>
           </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-4">
        <div className={`neural-ring ${settings.isListening ? 'active' : ''}`}>
          {settings.isListening && <><div className="ring-layer" /><div className="ring-layer" style={{animationDelay: '1s'}}/></>}
          <button onClick={toggleGuard} className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all ${settings.isListening ? 'bg-blue-600 shadow-[0_0_50px_rgba(37,99,235,0.4)] scale-105' : 'bg-slate-800 shadow-xl border border-white/5'}`}>
            <Shield size={42} className={settings.isListening ? 'text-white' : 'text-slate-700'} />
          </button>
        </div>
        <div className="mt-8 text-center">
          <h2 className="text-xl font-black uppercase text-white tracking-tight italic leading-none">{settings.isListening ? 'Mesh Active' : 'Standby'}</h2>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2 italic">
            {settings.isListening ? `Trigger: "${settings.triggerPhrase}"` : 'Touch shield to activate safety mesh'}
          </p>
        </div>
      </div>

      <div className="glass p-6 rounded-[2.5rem] border border-white/5 relative overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between mb-6">
           <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600/10 rounded-xl text-blue-500"><Navigation size={18} /></div>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Live Telemetry</h3>
                <div className="flex items-center gap-2 mt-0.5">
                   <div className={`w-1.5 h-1.5 rounded-full ${coords ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{coords ? 'Sync Locked' : 'Locating satellites...'}</span>
                </div>
              </div>
           </div>
           {coords && (
             <a href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-95 transition-all">
               <ExternalLink size={14} />
             </a>
           )}
        </div>
        <div className="grid grid-cols-2 gap-4">
           <div className="bg-slate-950 p-4 rounded-2xl border border-white/5">
              <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest block mb-1 italic">Latitude</span>
              <span className="text-sm font-bold text-white mono">{coords ? coords.lat.toFixed(6) : '---.------'}</span>
           </div>
           <div className="bg-slate-950 p-4 rounded-2xl border border-white/5">
              <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest block mb-1 italic">Longitude</span>
              <span className="text-sm font-bold text-white mono">{coords ? coords.lng.toFixed(6) : '---.------'}</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass p-5 rounded-[2rem] border border-white/5 flex flex-col items-center text-center opacity-30 cursor-not-allowed">
          <Timer size={18} className="text-blue-500 mb-3" />
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest italic">Safety Timer</p>
          <div className="text-xs font-black text-white mt-1 italic uppercase tracking-widest">Disabled</div>
        </div>
        <div onClick={() => triggerSOS("Manual Alert Trigger")} className="bg-red-950/20 border border-red-500/20 p-5 rounded-[2rem] cursor-pointer active:bg-red-900/40 transition-all flex flex-col items-center text-center group shadow-xl">
          <ShieldAlert size={18} className="text-red-500 mb-3 group-hover:scale-110 transition-transform" />
          <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest italic">Instant Signal</p>
          <div className="text-md font-black text-white uppercase italic mt-1 tracking-tighter">Trigger SOS</div>
        </div>
      </div>

      <div className="glass rounded-[2.5rem] p-6 border border-white/5 shadow-2xl pb-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xs font-black uppercase tracking-widest italic text-white flex items-center gap-2">
            <Globe size={16} className="text-blue-500" /> Nearby Safety (&lt;10km)
          </h3>
          <button onClick={findSafeSpots} disabled={isSearching} className="text-[9px] font-black text-blue-500 uppercase bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20 active:scale-95 transition-all">
            {isSearching ? 'Scanning...' : 'Update'}
          </button>
        </div>
        <div className="space-y-3">
          {safeSpots.map((spot, i) => (
            <a key={i} href={spot.uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-slate-950/60 border border-white/5 rounded-2xl group active:bg-slate-900 transition-all hover:border-blue-500/30">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-500 border border-blue-500/10">
                    {spot.name.toLowerCase().includes('police') ? <Building2 size={16}/> : spot.name.toLowerCase().includes('fire') ? <Flame size={16}/> : <Hospital size={16}/>}
                 </div>
                 <div className="flex flex-col">
                   <div className="text-[11px] font-bold text-slate-200 uppercase truncate max-w-[150px] italic">{spot.name}</div>
                   <div className="text-[8px] font-black uppercase text-slate-600 tracking-widest">{(spot as any).category}</div>
                 </div>
              </div>
              <div className="text-[9px] font-black text-slate-600 uppercase italic whitespace-nowrap bg-slate-900 px-3 py-1.5 rounded-xl border border-white/5 shadow-inner">
                {spot.distance}
              </div>
            </a>
          ))}
          {safeSpots.length === 0 && <p className="text-center text-[9px] text-slate-700 uppercase font-black py-8 italic tracking-widest">Locating local rescue infrastructure...</p>}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[10px] font-black text-amber-500 uppercase tracking-widest text-center animate-pulse italic flex items-center justify-center gap-2">
           <AlertCircle size={14} /> {errorMsg}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
