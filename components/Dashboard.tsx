
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
      watchIdRef.current = startLocationWatch(
        (c: GuardianCoords) => setCoords(c),
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
      setErrorMsg("Voice triggers not supported on this browser.");
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

    recognition.onerror = () => {
      if (settings.isListening) setTimeout(() => { try { recognition.start(); } catch(e) {} }, 1000);
    };

    recognition.onend = () => {
      if (settings.isListening) { try { recognition.start(); } catch(e) {} }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      setErrorMsg("Microphone access blocked.");
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
      setErrorMsg("Mesh push failed.");
    }
  };

  const findSafeSpots = async () => {
    if (!coords) {
      setErrorMsg("GPS Lock required.");
      return;
    }
    setIsSearching(true);
    setErrorMsg(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Locate safety resources at ${coords.lat}, ${coords.lng}.`,
      });
      
      setSafeSpots([
        { name: "Nearest Police Station", uri: `https://www.google.com/maps/search/police+station/@${coords.lat},${coords.lng},15z` },
        { name: "Nearest Hospital", uri: `https://www.google.com/maps/search/hospital/@${coords.lat},${coords.lng},15z` },
        { name: "Safe Haven (24h)", uri: `https://www.google.com/maps/search/emergency/@${coords.lat},${coords.lng},15z` }
      ]);
    } catch (e: any) {
      setErrorMsg("AI Mesh disconnected.");
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
            className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${settings.isListening ? 'bg-sky-500 shadow-[0_0_40px_rgba(56,189,248,0.5)] scale-110' : 'bg-slate-900'}`}
          >
            <Power size={48} className={settings.isListening ? 'text-white' : 'text-slate-700'} />
          </button>
        </div>
        
        <div className="mt-8 text-center space-y-1">
          <h2 className="text-2xl font-black tracking-tight uppercase italic flex items-center gap-2 justify-center leading-none">
            {settings.isListening ? <Activity className="text-sky-400 animate-pulse" size={20} /> : null}
            {settings.isListening ? 'Shield Active' : 'Shield Standby'}
          </h2>
          <p className="text-[10px] mono text-slate-500 uppercase tracking-widest">
            {settings.isListening ? `Trigger: "${settings.triggerPhrase}"` : 'Tactical Offline'}
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
          className={`glass p-6 rounded-[2.5rem] border transition-all cursor-pointer ${timerActive ? 'border-sky-500/50 bg-sky-500/5' : 'border-white/5'}`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className={`p-2.5 rounded-xl ${timerActive ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
              <Timer size={20} />
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mesh Timer</p>
          <div className="text-xl font-black mono mt-1">
            {timerActive ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : 'Check-In'}
          </div>
        </div>

        <div onClick={() => triggerSOS("Manual SOS Tap")} className="bg-red-950/20 border border-red-500/20 p-6 rounded-[2.5rem] flex flex-col justify-between active:scale-95 transition-transform cursor-pointer">
          <div className="p-2.5 bg-red-600 rounded-xl w-fit text-white shadow-lg shadow-red-500/20">
            <ShieldAlert size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Emergency</p>
            <div className="text-xl font-black italic tracking-tighter text-white uppercase">Panic SOS</div>
          </div>
        </div>
      </div>

      <div className="glass rounded-[2.5rem] p-6 border border-white/5">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
              <Globe size={18} />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest italic">Safe Zones</h3>
          </div>
          <button 
            onClick={findSafeSpots}
            disabled={isSearching || !coords}
            className="text-[10px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-1 disabled:opacity-50"
          >
            {isSearching ? 'Scanning...' : 'Scan'} <Search size={12} />
          </button>
        </div>

        <div className="space-y-3">
          {safeSpots.length > 0 ? safeSpots.map((spot, i) => (
            <a 
              key={i} href={spot.uri} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-slate-950/50 border border-white/5 rounded-2xl group hover:border-sky-500/30 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="bg-slate-800 p-2 rounded-lg text-slate-500 group-hover:text-sky-400 transition-colors">
                  <MapPin size={16} />
                </div>
                <span className="text-[11px] font-black text-slate-300 truncate pr-4">{spot.name}</span>
              </div>
              <ChevronRight size={16} className="text-slate-700 shrink-0" />
            </a>
          )) : (
            <div className="py-8 text-center text-slate-700 border border-dashed border-white/5 rounded-3xl">
              <p className="text-[9px] font-black uppercase tracking-[0.3em]">{isSearching ? 'Consulting AI...' : 'No active safe zones'}</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 py-3 flex items-center justify-between mono text-[9px] text-slate-600 bg-slate-950/50 rounded-full border border-white/5">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${coords ? 'bg-sky-500 animate-pulse' : 'bg-slate-800'}`} />
          <span>{coords ? 'SATELLITE LOCK' : 'GPS SEARCHING'}</span>
        </div>
        <span>{coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : '00.00, 00.00'}</span>
      </div>
    </div>
  );
};

export default Dashboard;
