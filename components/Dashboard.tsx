
import { GoogleGenAI } from "@google/genai";
import {
  Activity,
  AlertCircle,
  ChevronRight,
  Globe,
  MapPin,
  Power,
  Search, ShieldAlert,
  Timer
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { startLocationWatch, stopLocationWatch } from '../services/LocationServices';
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
      setErrorMsg(null); // Clear previous errors when starting
      watchIdRef.current = startLocationWatch(
        (c: GuardianCoords) => {
          setCoords(c);
          setErrorMsg(null);
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
  }, [settings.isListening, isEmergency]);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg("Voice activation is not supported in this browser.");
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
        triggerSOS(`Voice Activated: "${settings.triggerPhrase}"`);
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
      setErrorMsg("Mic access was denied.");
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
    const alertId = `alert_${Date.now()}`;
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
    } catch (e) {
      setErrorMsg("Emergency alert failed to send.");
    }
  };

  const findSafeSpots = async () => {
    if (!coords) {
      setErrorMsg("GPS lock required for scanning.");
      return;
    }
    setIsSearching(true);
    setErrorMsg(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Locate hospital and police resources near ${coords.lat}, ${coords.lng}.`,
      });
      
      setSafeSpots([
        { name: "Local Police Division", uri: `https://www.google.com/maps/search/police/@${coords.lat},${coords.lng},15z` },
        { name: "Nearest Medical Center", uri: `https://www.google.com/maps/search/hospital/@${coords.lat},${coords.lng},15z` },
        { name: "Public Safety Zone", uri: `https://www.google.com/maps/search/emergency/@${coords.lat},${coords.lng},15z` }
      ]);
    } catch (e: any) {
      setErrorMsg("AI service unavailable.");
    } finally {
      setIsSearching(false);
    }
  };

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
          <h2 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2 justify-center leading-none">
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
          <div className="text-xl font-bold mono mt-1">
            {timerActive ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : 'Check-In'}
          </div>
        </div>

        <div onClick={() => triggerSOS("Manual Alert Tap")} className="bg-red-950/20 border border-red-500/10 p-6 rounded-[2rem] flex flex-col justify-between active:scale-95 transition-transform cursor-pointer hover:bg-red-950/30">
          <div className="p-2.5 bg-red-600 rounded-xl w-fit text-white shadow-lg shadow-red-600/20">
            <ShieldAlert size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Emergency</p>
            <div className="text-xl font-black tracking-tight text-white uppercase italic">Send SOS</div>
          </div>
        </div>
      </div>

      <div className="glass rounded-[2.5rem] p-6 border border-white/5">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <Globe size={18} />
            </div>
            <h3 className="text-sm font-extrabold uppercase tracking-widest italic">Nearby Help</h3>
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
        <span className="font-bold">{coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : '--.----, --.----'}</span>
      </div>
    </div>
  );
};

export default Dashboard;
