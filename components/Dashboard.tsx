
import { GoogleGenAI } from "@google/genai";
import {
  Activity,
  AlertCircle,
  ChevronRight,
  Globe,
  MapPin,
  Power,
  Search, ShieldAlert,
  Timer,
  Zap
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { startLocationWatch, stopLocationWatch } from '../services/LocationService';
import { ref, rtdb, set } from '../services/firebase';
import { AlertLog, AppSettings, User as AppUser, GuardianCoords, SafeSpot } from '../types';

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
  
  const watchIdRef = useRef<number>(-1);
  const timerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timerActive && timeLeft === 0) {
      triggerSOS("Safety Timer Expired");
    }
    return () => clearTimeout(timerRef.current);
  }, [timerActive, timeLeft]);

  useEffect(() => {
    if (settings.isListening || isEmergency) {
      watchIdRef.current = startLocationWatch(
        (c: GuardianCoords) => setCoords(c),
        (err: string) => console.error("[Aegis GPS] Signal Error:", err)
      );
    } else {
      if (watchIdRef.current !== -1) {
        stopLocationWatch(watchIdRef.current);
        watchIdRef.current = -1;
      }
    }
    return () => stopLocationWatch(watchIdRef.current);
  }, [settings.isListening, isEmergency]);

  // Zero-Cost Trigger Detection using Web Speech API
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg("Browser does not support voice triggers.");
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
      
      if (transcript.includes(settings.triggerPhrase.toLowerCase())) {
        triggerSOS(`Voice Triggered: "${settings.triggerPhrase}"`);
      }
    };

    recognition.onerror = (e: any) => {
      console.warn("Speech recognition error:", e.error);
      if (settings.isListening) setTimeout(() => recognition.start(), 1000);
    };

    recognition.onend = () => {
      if (settings.isListening) recognition.start();
    };

    recognition.start();
    recognitionRef.current = recognition;
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
    const alertId = `alert_${Date.now()}`;
    const log: AlertLog = {
      id: alertId,
      senderPhone: user.phone,
      senderName: user.name,
      timestamp: Date.now(),
      location: coords,
      message: reason,
      isLive: true,
      recipients: settings.contacts.map(c => c.phone)
    };
    
    await set(ref(rtdb, `alerts/${alertId}`), log);
    onAlert(log);
    setTimerActive(false);
  };

  const findSafeSpots = async () => {
    if (!coords) return;
    setIsSearching(true);
    setErrorMsg(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Using gemini-3-flash-preview + googleSearch for Free Tier stability
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `I am currently at Latitude ${coords.lat}, Longitude ${coords.lng}. 
        Find the 3 nearest police stations or 24-hour hospitals in this specific area for emergency safety. 
        Provide only their names and a Google Maps search link for each.`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      
      const text = response.text || "";
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      
      // Parse search results for links
      const spots: SafeSpot[] = [];
      chunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          spots.push({
            name: chunk.web.title || "Safety Resource",
            uri: chunk.web.uri
          });
        }
      });

      // Fallback if chunks are empty but text has data
      if (spots.length === 0) {
        setSafeSpots([{
          name: "Search Results",
          uri: `https://www.google.com/maps/search/police+station+near+me/@${coords.lat},${coords.lng},15z`
        }]);
      } else {
        setSafeSpots(spots.slice(0, 3));
      }
    } catch (e: any) {
      console.error("[SafeSpots] Error:", e);
      setErrorMsg("Free Search Tier exhausted or offline.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col items-center justify-center pt-8">
        <div className={`neural-ring ${settings.isListening ? 'active' : ''}`}>
          {settings.isListening && (
            <>
              <div className="ring-layer" style={{ animationDelay: '0s' }} />
              <div className="ring-layer" style={{ animationDelay: '1s' }} />
            </>
          )}
          <button 
            onClick={toggleGuard}
            className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${settings.isListening ? 'bg-sky-500 shadow-[0_0_40px_rgba(56,189,248,0.5)] scale-110' : 'bg-slate-800'}`}
          >
            <Power size={48} className={settings.isListening ? 'text-white' : 'text-slate-500'} />
          </button>
        </div>
        
        <div className="mt-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight uppercase italic flex items-center gap-2 justify-center leading-none">
            {settings.isListening ? <Activity className="text-sky-400 animate-pulse" size={20} /> : null}
            {settings.isListening ? 'Shield Active' : 'Shield Standby'}
          </h2>
          <p className="text-[10px] mono text-slate-500 uppercase tracking-widest mt-3">
            {settings.isListening ? `Watching for: "${settings.triggerPhrase}"` : 'Tactical Guard Offline'}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="mx-2 p-4 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-start gap-4">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <p className="text-[10px] text-red-400 font-black uppercase tracking-wider">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div 
          onClick={() => {
            if (timerActive) setTimerActive(false);
            else { setTimerActive(true); setTimeLeft(settings.checkInDuration * 60); }
          }}
          className={`glass p-5 rounded-[2rem] border transition-all cursor-pointer ${timerActive ? 'border-sky-500/50 bg-sky-500/5' : 'border-white/5'}`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className={`p-2.5 rounded-xl ${timerActive ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
              <Timer size={20} />
            </div>
            {timerActive && <div className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />}
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Aegis Timer</p>
          <div className="text-xl font-bold mono mt-1">
            {timerActive ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : 'Check-In'}
          </div>
        </div>

        <div onClick={() => triggerSOS("Manual SOS Tap")} className="bg-red-950/40 border border-red-500/20 p-5 rounded-[2rem] flex flex-col justify-between active:scale-95 transition-transform cursor-pointer">
          <div className="p-2.5 bg-red-600 rounded-xl w-fit text-white shadow-lg">
            <ShieldAlert size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Instant</p>
            <div className="text-xl font-bold italic tracking-tighter text-white uppercase">Panic SOS</div>
          </div>
        </div>
      </div>

      <div className="glass rounded-[2.5rem] p-6 border border-white/5">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
              <Globe size={18} />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-widest italic">Free Safe-Zones</h3>
          </div>
          <button 
            onClick={findSafeSpots}
            disabled={isSearching || !coords}
            className="text-[10px] font-bold text-sky-400 uppercase tracking-widest flex items-center gap-1 disabled:opacity-50"
          >
            {isSearching ? 'Scanning...' : 'Search'} <Search size={12} />
          </button>
        </div>

        <div className="space-y-3">
          {safeSpots.length > 0 ? safeSpots.map((spot, i) => (
            <a 
              key={i} href={spot.uri} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-slate-950/50 border border-white/5 rounded-2xl group hover:border-sky-500/30 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="bg-slate-800 p-2 rounded-lg text-slate-400 group-hover:text-sky-400">
                  <MapPin size={16} />
                </div>
                <span className="text-[11px] font-bold text-slate-300 truncate pr-4">{spot.name}</span>
              </div>
              <ChevronRight size={16} className="text-slate-600 shrink-0" />
            </a>
          )) : (
            <div className="py-8 text-center text-slate-700">
              <Zap size={24} className="mx-auto mb-2 opacity-20" />
              <p className="text-[9px] font-bold uppercase tracking-widest leading-relaxed">
                {isSearching ? 'Accessing Mesh Data...' : 'Tap Scan to use Free AI Search'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 py-3 flex items-center justify-between mono text-[9px] text-slate-600 bg-slate-950/50 rounded-full border border-white/5">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${coords ? 'bg-green-500 animate-pulse' : 'bg-slate-800'}`} />
          <span>{coords ? 'LOCK ACQUIRED' : 'SEARCHING...'}</span>
        </div>
        <span>{coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : '0.0000, 0.0000'}</span>
      </div>
    </div>
  );
};

export default Dashboard;
