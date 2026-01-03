import { GoogleGenAI } from "@google/genai";
import {
  Activity,
  ChevronRight,
  Compass,
  MapPin,
  Power,
  Search, ShieldAlert,
  Timer,
  Zap
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { startLocationWatch, stopLocationWatch } from '../services/LocationServices';
import { ref, rtdb, set } from '../services/firebase';
import { GeminiVoiceMonitor } from '../services/geminiService';
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
  
  const monitorRef = useRef<GeminiVoiceMonitor | null>(null);
  const watchIdRef = useRef<number>(-1);
  const timerRef = useRef<any>(null);

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
      // Fix: Explicitly typed parameters for the callback functions
      watchIdRef.current = startLocationWatch(
        (c: GuardianCoords) => {
          setCoords(c);
        },
        (err: string) => {
          console.error("[Aegis GPS] Signal Error:", err);
        }
      );
    } else {
      if (watchIdRef.current !== -1) {
        stopLocationWatch(watchIdRef.current);
        watchIdRef.current = -1;
      }
    }
    return () => stopLocationWatch(watchIdRef.current);
  }, [settings.isListening, isEmergency]);

  const toggleGuard = async () => {
    if (settings.isListening) {
      if (monitorRef.current) await monitorRef.current.stop();
      monitorRef.current = null;
      updateSettings({ isListening: false });
    } else {
      const monitor = new GeminiVoiceMonitor({
        triggerPhrase: settings.triggerPhrase,
        onAlert: (phrase: string) => triggerSOS(`Voice Trigger: ${phrase}`),
        onFakeCall: () => alert("INCOMING CALL: Home Security"),
        onError: () => updateSettings({ isListening: false })
      });
      await monitor.start();
      monitorRef.current = monitor;
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
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `I am at lat: ${coords.lat}, lng: ${coords.lng}. List nearest police stations or 24/7 safe hospitals for immediate safety.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: { retrievalConfig: { latLng: { latitude: coords.lat, longitude: coords.lng } } }
        }
      });
      
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const spots = chunks
        .filter((c: any) => c.maps)
        .map((c: any) => ({
          name: c.maps.title,
          uri: c.maps.uri
        })) as SafeSpot[];
      
      setSafeSpots(spots.slice(0, 3));
    } catch (e) {
      console.error("[SafeSpots] Grounding Failed:", e);
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
          <h2 className="text-2xl font-bold tracking-tight uppercase italic flex items-center gap-2 justify-center">
            {settings.isListening ? <Activity className="text-sky-400 animate-pulse" size={20} /> : null}
            {settings.isListening ? 'Mesh Active' : 'Mesh Standby'}
          </h2>
          <p className="text-[10px] mono text-slate-500 uppercase tracking-widest mt-2">
            {settings.isListening ? `Monitoring: "${settings.triggerPhrase}"` : 'Tactical AI Guard Offline'}
          </p>
        </div>
      </div>

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
              <Compass size={18} />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-widest italic">Tactical Safe Zones</h3>
          </div>
          <button 
            onClick={findSafeSpots}
            disabled={isSearching || !coords}
            className="text-[10px] font-bold text-sky-400 uppercase tracking-widest flex items-center gap-1 disabled:opacity-50"
          >
            {isSearching ? 'Scanning...' : 'Scan Area'} <Search size={12} />
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
                <span className="text-xs font-bold text-slate-300">{spot.name}</span>
              </div>
              <ChevronRight size={16} className="text-slate-600" />
            </a>
          )) : (
            <div className="py-8 text-center text-slate-700">
              <Zap size={24} className="mx-auto mb-2 opacity-20" />
              <p className="text-[9px] font-bold uppercase tracking-widest">No mesh path data available</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-2 flex items-center justify-between mono text-[10px] text-slate-600 bg-slate-950/30 rounded-full border border-white/5">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${coords ? 'bg-green-500' : 'bg-slate-700'}`} />
          <span>SATELLITE LOCK</span>
        </div>
        <span>{coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'SCANNING...'}</span>
      </div>
    </div>
  );
};

export default Dashboard;