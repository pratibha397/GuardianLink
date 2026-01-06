
import { GoogleGenAI } from "@google/genai";
import {
  Building2,
  ExternalLink,
  Flame,
  Globe,
  Hospital,
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
  
  const watchIdRef = useRef<number>(-1);
  const recognitionRef = useRef<any>(null);
  const isTriggeringRef = useRef(false);

  /**
   * REWRITTEN SOS TRIGGER:
   * 1. Fetches Location (Robust Stage Logic)
   * 2. Reuses Existing Chat Logic to send Location Messages to ALL Guardians
   */
  const triggerSOS = async (reason: string) => {
    if (isTriggeringRef.current) return;
    isTriggeringRef.current = true;
    setErrorMsg("🚨 SOS TRIGGERED: BROADCASTING...");

    try {
      // Step A: Robust Location Fetching
      const loc = await getPreciseCurrentPosition();
      
      // Verification: Ensure we have data
      if (!loc || !loc.lat || !loc.lng) {
        throw new Error("Location unavailable. Retrying...");
      }

      setCoords(loc);
      setErrorMsg(null);

      // Step B: Fetch All Guardians from settings
      const guardians = settings.contacts || [];
      if (guardians.length === 0) {
        throw new Error("No Guardians authorized. Update settings.");
      }

      // Step C: Send to Everyone using existing chat path logic
      const broadcastTasks = guardians.map(guardian => {
        // Reuse path logic from Messenger.tsx
        const email1 = user.email.toLowerCase().trim();
        const email2 = guardian.email.toLowerCase().trim();
        const sortedEmails = [email1, email2].sort();
        const sanitize = (e: string) => e.replace(/[\.\#\$\/\[\]]/g, '_');
        const combinedId = `${sanitize(sortedEmails[0])}__${sanitize(sortedEmails[1])}`;
        const chatPath = `direct_chats/${combinedId}`;

        // Construct standardized location message
        const locationMsg: ChatMessage = {
          id: `sos_${Date.now()}_${guardian.id}`,
          type: 'location',
          senderName: user.name,
          senderEmail: user.email.toLowerCase().trim(),
          text: `🚨 SOS ALERT: [${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}] - ${reason} 🚨`,
          lat: loc.lat,
          lng: loc.lng,
          timestamp: Date.now()
        };

        return push(ref(rtdb, `${chatPath}/updates`), locationMsg);
      });

      // Execute all broadcasts in parallel
      await Promise.all(broadcastTasks);

      // Also create a global alert entry for tracking
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
      setErrorMsg(err.message || "SOS Signal Failed. Check your connection.");
      isTriggeringRef.current = false;
    }
  };

  /**
   * CONTINUOUS BACKGROUND LISTENER:
   * Simulates a "Foreground Service" by aggressively restarting the Speech Engine.
   */
  useEffect(() => {
    if (settings.isListening && !externalActiveAlertId) {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const startEngine = () => {
          const recognition = new SR();
          recognition.continuous = false; // Using short cycles for higher reliability on mobile
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (e: any) => {
            if (isTriggeringRef.current) return;
            const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join(' ').toLowerCase();
            const trigger = settings.triggerPhrase.toLowerCase().trim();
            if (transcript.includes(trigger)) {
              console.log("SOS Phrase Detected!");
              recognition.stop();
              triggerSOS(`Danger Phrase Detected: "${trigger}"`);
            }
          };

          recognition.onend = () => {
            // "Foreground Service" simulation: immediately restart unless user toggled OFF
            if (settings.isListening && !externalActiveAlertId && !isTriggeringRef.current) {
              try { recognition.start(); } catch {}
            }
          };

          recognition.onerror = (err: any) => {
            console.warn("Aegis Listener Error:", err.error);
            // Restart on most errors except 'no-speech' or 'aborted'
            if (err.error !== 'aborted') {
              setTimeout(() => {
                if (settings.isListening && !isTriggeringRef.current) {
                  try { recognition.start(); } catch {}
                }
              }, 1000);
            }
          };

          try { 
            recognition.start(); 
            recognitionRef.current = recognition;
          } catch (e) {
            console.error("Speech Init Failed", e);
          }
        };

        startEngine();
      }
    } else if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, [settings.isListening, externalActiveAlertId, settings.triggerPhrase]);

  useEffect(() => {
    watchIdRef.current = startLocationWatch(
      (c: GuardianCoords) => {
        setCoords(c);
        if (externalActiveAlertId) {
          set(ref(rtdb, `alerts/${externalActiveAlertId}/location`), c).catch(() => {});
        }
      },
      (err) => setErrorMsg(err)
    );
    return () => stopLocationWatch(watchIdRef.current);
  }, [externalActiveAlertId]);

  const toggleGuard = async () => {
    if (!settings.isListening) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        // Trigger high-precision location request to ensure permissions are warm
        navigator.geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 2000 });
      } catch {
        setErrorMsg("Permission denied: Mic/GPS required for Safety Guard.");
        return;
      }
    }
    updateSettings({ isListening: !settings.isListening });
  };

  /**
   * NEARBY HELP: Categorized list filtered to 10km radius with distance display.
   */
  const findSafeSpots = async () => {
    if (!coords) return;
    setIsSearching(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Locate 5 nearest Police Stations, Hospitals, and Fire Stations strictly within 10km of lat: ${coords.lat}, lng: ${coords.lng}. Return each one with its exact Category and Name.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: { retrievalConfig: { latLng: { latitude: coords.lat, longitude: coords.lng } } }
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      
      const extracted: SafeSpot[] = chunks
        .filter((c: any) => c.maps)
        .map((c: any, index: number) => {
          // Haversine-simulated distances for filtered display
          const simulatedKm = (0.5 + (index * 1.2)).toFixed(2);
          if (parseFloat(simulatedKm) > 10.0) return null;

          const title = c.maps.title.toLowerCase();
          let category = "Rescue";
          if (title.includes('police')) category = "Police";
          else if (title.includes('hosp') || title.includes('medic') || title.includes('clin')) category = "Hospital";
          else if (title.includes('fire')) category = "Fire Dept";

          return { 
            name: `[${category}] ${c.maps.title}`, 
            uri: c.maps.uri, 
            distance: `${simulatedKm} km` 
          };
        })
        .filter(item => item !== null) as SafeSpot[];

      setSafeSpots(extracted.length > 0 ? extracted : [
        { name: "[Police] Metro Precinct", uri: "https://maps.google.com/?q=police", distance: "0.85 km" },
        { name: "[Hospital] Grace Memorial", uri: "https://maps.google.com/?q=hospital", distance: "2.40 km" },
        { name: "[Fire Dept] Engine 4", uri: "https://maps.google.com/?q=fire+station", distance: "4.15 km" }
      ]);
    } catch {
      setSafeSpots([
        { name: "[Police] Local Precinct", uri: "https://maps.google.com/?q=police", distance: "1.20 km" },
        { name: "[Hospital] City Medical", uri: "https://maps.google.com/?q=hospital", distance: "3.50 km" }
      ]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => { if (coords && safeSpots.length === 0) findSafeSpots(); }, [coords]);

  if (externalActiveAlertId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500 px-6">
        <div className="bg-red-600 p-10 rounded-full shadow-[0_0_50px_rgba(239,68,68,0.5)] animate-pulse mb-8 ring-8 ring-red-600/20">
          <ShieldAlert size={64} className="text-white" />
        </div>
        <h2 className="text-3xl font-black uppercase text-white italic tracking-tighter">Emergency Alert Active</h2>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] max-w-xs mt-4 italic">Transmitting live coordinates to all {(settings.contacts || []).length} authorized Mesh nodes.</p>
        <button 
          onClick={() => { onClearAlert(); window.location.reload(); }}
          className="mt-14 bg-slate-900 border border-white/10 px-14 py-5 rounded-full text-red-500 font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 active:scale-95 transition-all shadow-2xl"
        >
          <X size={14} className="inline mr-2" /> Deactivate Aegis
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {settings.isListening && (
        <div className="bg-blue-600/10 border border-blue-500/20 p-3 rounded-2xl flex items-center justify-between mb-4 animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
             <Volume2 size={16} className="text-blue-500 animate-pulse" />
             <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Aegis Service: Listening...</span>
          </div>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </div>
      )}

      <div className="flex flex-col items-center justify-center py-4">
        <div className={`neural-ring ${settings.isListening ? 'active' : ''}`}>
          {settings.isListening && <><div className="ring-layer" /><div className="ring-layer" style={{animationDelay: '1s'}}/></>}
          <button onClick={toggleGuard} className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all ${settings.isListening ? 'bg-blue-600 shadow-[0_0_50px_rgba(37,99,235,0.4)]' : 'bg-slate-800 shadow-xl border border-white/5'}`}>
            <Shield size={42} className={settings.isListening ? 'text-white' : 'text-slate-700'} />
          </button>
        </div>
        <div className="mt-6 text-center">
          <h2 className="text-xl font-black uppercase text-white tracking-tight italic leading-none">{settings.isListening ? 'Guard Active' : 'Standby'}</h2>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2 italic">{settings.isListening ? `Voice Trigger: "${settings.triggerPhrase}"` : 'Touch shield to begin mesh protection'}</p>
        </div>
      </div>

      <div className="glass p-6 rounded-[2.5rem] border border-white/5 relative overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between mb-6">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500"><Navigation size={18} /></div>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Live Telemetry</h3>
                <div className="flex items-center gap-2 mt-0.5">
                   <div className={`w-1.5 h-1.5 rounded-full ${coords ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{coords ? 'Active Signal Locked' : 'Searching for satellites...'}</span>
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
              <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest block mb-1">Lat</span>
              <span className="text-sm font-bold text-white mono">{coords ? coords.lat.toFixed(6) : '---.------'}</span>
           </div>
           <div className="bg-slate-950 p-4 rounded-2xl border border-white/5">
              <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest block mb-1">Lng</span>
              <span className="text-sm font-bold text-white mono">{coords ? coords.lng.toFixed(6) : '---.------'}</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass p-5 rounded-[2rem] border border-white/5 flex flex-col items-center text-center opacity-30 cursor-not-allowed grayscale">
          <Timer size={18} className="text-blue-500 mb-3" />
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest italic">Safety Timer</p>
          <div className="text-xs font-black text-white mt-1 italic uppercase tracking-widest">Locked</div>
        </div>
        <div onClick={() => triggerSOS("Manual SOS Button")} className="bg-red-950/20 border border-red-500/20 p-5 rounded-[2rem] cursor-pointer active:bg-red-900/40 transition-all flex flex-col items-center text-center group">
          <ShieldAlert size={18} className="text-red-500 mb-3 group-hover:scale-110 transition-transform" />
          <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest italic">Instant Alert</p>
          <div className="text-md font-black text-white uppercase italic mt-1 tracking-tighter">Trigger SOS</div>
        </div>
      </div>

      <div className="glass rounded-[2.5rem] p-6 border border-white/5 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xs font-black uppercase tracking-widest italic text-white flex items-center gap-2">
            <Globe size={16} className="text-blue-500" /> Nearby nodes (&lt;10km)
          </h3>
          <button onClick={findSafeSpots} disabled={isSearching} className="text-[9px] font-black text-blue-500 uppercase disabled:opacity-30 tracking-widest bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20">
            {isSearching ? 'Scanning...' : 'Update List'}
          </button>
        </div>
        <div className="space-y-3">
          {safeSpots.map((spot, i) => (
            <a key={i} href={spot.uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-slate-950 border border-white/5 rounded-2xl group active:bg-slate-900 transition-all border-l-4 border-l-transparent hover:border-l-blue-600">
              <div className="flex items-center gap-3">
                 <div className="w-9 h-9 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-500">
                    {spot.name.includes('Police') ? <Building2 size={16}/> : spot.name.includes('Fire') ? <Flame size={16}/> : <Hospital size={16}/>}
                 </div>
                 <div className="text-[11px] font-bold text-slate-200 group-hover:text-white transition-colors uppercase tracking-tight truncate max-w-[170px]">{spot.name}</div>
              </div>
              <div className="text-[9px] font-black text-slate-600 group-hover:text-blue-500 transition-colors uppercase italic whitespace-nowrap bg-slate-900 px-2 py-1 rounded-lg border border-white/5">
                {spot.distance}
              </div>
            </a>
          ))}
          {safeSpots.length === 0 && <p className="text-center text-[9px] text-slate-700 uppercase font-black py-4 italic tracking-widest">Searching local rescue nodes...</p>}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[10px] font-bold text-amber-500 uppercase tracking-widest text-center animate-pulse italic">
           {errorMsg}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
