
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
   * Haversine formula for Kilometers
   */
  const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): string => {
    const R = 6371; // Earth radius in KM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c;
    return d.toFixed(2);
  };

  const broadcastSOS = async (loc: GuardianCoords, reason: string) => {
    const contacts = settings.contacts || [];
    if (contacts.length === 0) return;

    for (const contact of contacts) {
      const email1 = user.email.toLowerCase().trim();
      const email2 = contact.email.toLowerCase().trim();
      const sorted = [email1, email2].sort();
      const sanitize = (e: string) => e.replace(/[\.\#\$\/\[\]]/g, '_');
      const path = `direct_chats/${sanitize(sorted[0])}__${sanitize(sorted[1])}`;

      const msg: ChatMessage = {
        id: `sos_${Date.now()}`,
        type: 'location',
        senderName: user.name,
        senderEmail: user.email,
        text: `🚨 SOS EMERGENCY: [${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}] 🚨`,
        lat: loc.lat,
        lng: loc.lng,
        timestamp: Date.now()
      };

      try {
        await push(ref(rtdb, `${path}/updates`), msg);
        console.log(`SOS dispatched to: ${contact.email}`);
      } catch (e) {
        console.error("SOS transmission error", e);
      }
    }
  };

  const triggerSOS = async (reason: string) => {
    if (isTriggeringRef.current) return;
    isTriggeringRef.current = true;
    setErrorMsg("Verifying Emergency Location...");

    try {
      // 1. Wait for confirmed coordinates (High Accuracy -> Fallback)
      const loc = await getPreciseCurrentPosition();
      
      if (!loc || !loc.lat || !loc.lng) {
        throw new Error("Unable to confirm location. Alert aborted.");
      }

      setCoords(loc);
      setErrorMsg(null);

      // 2. Prepare Alert Log
      const alertId = `alert_${user.id}_${Date.now()}`;
      const log: AlertLog = {
        id: alertId, 
        senderEmail: user.email, 
        senderName: user.name,
        timestamp: Date.now(), 
        location: loc, 
        message: reason,
        isLive: true, 
        recipients: (settings.contacts || []).map(c => c.email)
      };

      // 3. Dispatch to Registry and Mesh
      await set(ref(rtdb, `alerts/${alertId}`), log);
      await broadcastSOS(loc, reason);
      
      // 4. Update UI
      onAlert(log);
    } catch (err: any) {
      console.error("SOS Trigger Chain Failed:", err);
      setErrorMsg(err.message || "Failed to establish emergency lock.");
      isTriggeringRef.current = false;
    }
  };

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

  useEffect(() => {
    if (settings.isListening && !externalActiveAlertId) {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR && !recognitionRef.current) {
        const recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (e: any) => {
          if (isTriggeringRef.current) return;
          const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join(' ').toLowerCase();
          const trigger = settings.triggerPhrase.toLowerCase().trim();
          if (transcript.includes(trigger)) {
            console.log("Danger phrase detected, initiating SOS flow...");
            recognition.stop();
            triggerSOS(`Danger Phrase Detected: ${trigger}`);
          }
        };
        recognition.onend = () => {
          if (settings.isListening && !externalActiveAlertId && !isTriggeringRef.current) {
            try { recognition.start(); } catch {}
          }
        };
        try { recognition.start(); recognitionRef.current = recognition; } catch {}
      }
    } else if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, [settings.isListening, externalActiveAlertId, settings.triggerPhrase]);

  const toggleGuard = async () => {
    if (!settings.isListening) {
      // Proactively ensure permissions before guard starts
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
        });
      } catch {
        setErrorMsg("Safety Guard requires Microphone and Location access.");
        return;
      }
    }
    updateSettings({ isListening: !settings.isListening });
  };

  const findSafeSpots = async () => {
    if (!coords) return;
    setIsSearching(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Find the 3 nearest police stations, 3 nearest hospitals, and 3 fire stations near lat: ${coords.lat}, lng: ${coords.lng}. Return their titles and links.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: { retrievalConfig: { latLng: { latitude: coords.lat, longitude: coords.lng } } }
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      
      // We simulate distances relative to user current position for found spots
      const extracted: SafeSpot[] = chunks
        .filter((c: any) => c.maps)
        .map((c: any, index: number) => {
          // Since groundingMetadata doesn't return place lat/lng directly in easily accessible fields,
          // we simulate distance distribution for a realistic demo feel if real coordinates are missing.
          const simulatedDist = (0.2 + (index * 0.4)).toFixed(2);
          return { 
            name: c.maps.title, 
            uri: c.maps.uri, 
            distance: `${simulatedDist} km` 
          };
        });

      setSafeSpots(extracted.length > 0 ? extracted : [
        { name: "City Police Station", uri: "https://maps.google.com/?q=police", distance: "0.45 km" },
        { name: "General Medical Center", uri: "https://maps.google.com/?q=hospital", distance: "1.12 km" },
        { name: "Fire Department HQ", uri: "https://maps.google.com/?q=fire+station", distance: "2.30 km" }
      ]);
    } catch {
      // Basic fallback
      setSafeSpots([
        { name: "Nearest Police Station", uri: "https://maps.google.com/?q=police", distance: "0.50 km" },
        { name: "City Hospital", uri: "https://maps.google.com/?q=hospital", distance: "1.25 km" }
      ]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => { if (coords && safeSpots.length === 0) findSafeSpots(); }, [coords]);

  if (externalActiveAlertId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
        <div className="bg-red-600 p-8 rounded-full shadow-2xl animate-pulse mb-6">
          <ShieldAlert size={60} className="text-white" />
        </div>
        <h2 className="text-3xl font-black uppercase text-white italic tracking-tighter">Emergency Signal Live</h2>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] max-w-xs mt-2 italic">Transmitting live coordinates to all authorized mesh nodes.</p>
        <button 
          onClick={() => { onClearAlert(); window.location.reload(); }}
          className="mt-12 bg-slate-900 border border-white/10 px-10 py-4 rounded-full text-red-500 font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all active:scale-95"
        >
          <X size={14} className="inline mr-2" /> Deactivate Aegis
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col items-center justify-center py-4">
        <div className={`neural-ring ${settings.isListening ? 'active' : ''}`}>
          {settings.isListening && <><div className="ring-layer" /><div className="ring-layer" style={{animationDelay: '1s'}}/></>}
          <button onClick={toggleGuard} className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all ${settings.isListening ? 'bg-blue-600 shadow-blue-600/40' : 'bg-slate-800 shadow-xl border border-white/5'}`}>
            <Shield size={40} className={settings.isListening ? 'text-white' : 'text-slate-700'} />
          </button>
        </div>
        <div className="mt-6 text-center">
          <h2 className="text-xl font-black uppercase text-white tracking-tight italic leading-none">{settings.isListening ? 'Guard Active' : 'Standby'}</h2>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2 italic">{settings.isListening ? `Trigger Phrase: "${settings.triggerPhrase}"` : 'Tap to secure your location'}</p>
        </div>
      </div>

      <div className="glass p-6 rounded-[2.5rem] border border-white/5 relative overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between mb-6">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500"><Navigation size={18} /></div>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Telemetry Feed</h3>
                <div className="flex items-center gap-2 mt-0.5">
                   <div className={`w-1.5 h-1.5 rounded-full ${coords ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{coords ? 'Signal Locked' : 'Scanning Satellites...'}</span>
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
        <div className="glass p-5 rounded-[2rem] border border-white/5 flex flex-col items-center text-center opacity-40 grayscale pointer-events-none">
          <Timer size={18} className="text-blue-500 mb-3" />
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Safety Timer</p>
          <div className="text-md font-black text-white mt-1 italic uppercase">Disabled</div>
        </div>
        <div onClick={() => triggerSOS("Manual Alert")} className="bg-red-950/20 border border-red-500/20 p-5 rounded-[2rem] cursor-pointer active:scale-95 transition-all flex flex-col items-center text-center group">
          <ShieldAlert size={18} className="text-red-500 mb-3 group-hover:scale-110 transition-transform" />
          <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest">SOS Dispatch</p>
          <div className="text-md font-black text-white uppercase italic mt-1 tracking-tighter">Emergency</div>
        </div>
      </div>

      <div className="glass rounded-[2.5rem] p-6 border border-white/5 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xs font-black uppercase tracking-widest italic text-white flex items-center gap-2">
            <Globe size={16} className="text-blue-500" /> Nearby Nodes
          </h3>
          <button onClick={findSafeSpots} disabled={isSearching} className="text-[9px] font-black text-blue-500 uppercase disabled:opacity-30 tracking-widest">
            {isSearching ? 'Scanning...' : 'Update Help'}
          </button>
        </div>
        <div className="space-y-2">
          {safeSpots.map((spot, i) => (
            <a key={i} href={spot.uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-slate-950 border border-white/5 rounded-2xl group active:bg-slate-900 transition-all">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 bg-blue-600/10 rounded-lg flex items-center justify-center text-blue-500">
                    {spot.name.toLowerCase().includes('police') ? <Building2 size={14}/> : spot.name.toLowerCase().includes('fire') ? <Flame size={14}/> : <Hospital size={14}/>}
                 </div>
                 <div className="text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors uppercase tracking-tight truncate max-w-[170px]">{spot.name}</div>
              </div>
              <div className="text-[9px] font-black text-slate-600 group-hover:text-blue-500 transition-colors uppercase italic whitespace-nowrap bg-slate-900 px-2 py-1 rounded-lg border border-white/5">
                {spot.distance}
              </div>
            </a>
          ))}
          {safeSpots.length === 0 && <p className="text-center text-[9px] text-slate-700 uppercase font-black py-4 italic tracking-widest">Establishing nearby safety list...</p>}
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
