
import { AlertCircle, AlertTriangle, MapPin, Power, Radio, Users } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { GeminiVoiceMonitor } from '../services/geminiService';
import { AlertLog, AppSettings, EmergencyContact, User } from '../types';

interface DashboardProps {
  user: User;
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
  onAlertTriggered: (log: AlertLog) => void;
  isEmergency: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ user, settings, updateSettings, onAlertTriggered, isEmergency }) => {
  const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number} | null>(null);
  const monitorRef = useRef<GeminiVoiceMonitor | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.isListening || isEmergency) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos: GeolocationPosition) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentCoords(coords);
          
          if (isEmergency) {
            updateGlobalAlert(coords);
          }
        },
        (err: GeolocationPositionError) => console.error("Geo error:", err),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [settings.isListening, isEmergency]);

  const updateGlobalAlert = (coords: {lat: number, lng: number}) => {
    const GLOBAL_KEY = 'guardian_voice_global_alerts';
    const alerts: AlertLog[] = JSON.parse(localStorage.getItem(GLOBAL_KEY) || '[]');
    const myAlertIdx = alerts.findIndex(a => a.senderPhone === user.phone && a.isLive);
    if (myAlertIdx !== -1) {
      alerts[myAlertIdx].location = coords;
      localStorage.setItem(GLOBAL_KEY, JSON.stringify(alerts));
    }
  };

  const triggerAlert = () => {
    const coords = currentCoords;
    const locationStr = coords ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}` : 'Unavailable';
    const message = settings.messageTemplate.replace('{location}', locationStr);
    
    const newLog: AlertLog = {
      id: Date.now().toString(),
      senderPhone: user.phone,
      timestamp: Date.now(),
      location: coords,
      message,
      isLive: true,
      recipients: settings.contacts.map((c: EmergencyContact) => `${c.name} (${c.phone})`)
    };

    onAlertTriggered(newLog);
    
    if (navigator.share) {
      navigator.share({ title: 'EMERGENCY', text: message }).catch(() => {});
    }
  };

  const toggleListening = async () => {
    if (settings.isListening) {
      if (monitorRef.current) await monitorRef.current.stop();
      monitorRef.current = null;
      updateSettings({ isListening: false });
    } else {
      setError(null);
      const monitor = new GeminiVoiceMonitor({
        triggerPhrase: settings.triggerPhrase,
        onAlert: () => triggerAlert(),
        onError: (err: string) => { setError(err); updateSettings({ isListening: false }); }
      });
      await monitor.start();
      monitorRef.current = monitor;
      updateSettings({ isListening: true });
    }
  };

  return (
    <div className="space-y-6">
      <div className={`p-8 rounded-[2.5rem] flex flex-col items-center justify-center transition-all duration-700 border-2 ${
        settings.isListening 
          ? 'bg-blue-600/10 border-blue-500/50 shadow-[0_0_80px_-20px_rgba(59,130,246,0.5)]' 
          : 'bg-slate-800/50 border-slate-700/50'
      }`}>
        <button 
          onClick={toggleListening}
          className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all active:scale-90 group ${
            settings.isListening ? 'bg-blue-600 shadow-xl' : 'bg-slate-700 shadow-inner'
          }`}
        >
          {settings.isListening && (
            <div className="absolute inset-0 rounded-full animate-ping bg-blue-400/20" />
          )}
          <Power size={48} className={settings.isListening ? 'text-white' : 'text-slate-500'} />
        </button>
        
        <div className="mt-8 text-center space-y-2">
          <h2 className="text-2xl font-black text-white">{settings.isListening ? 'Secured' : 'Standby'}</h2>
          <div className="flex items-center gap-2 justify-center">
            {settings.isListening && <Radio size={14} className="text-blue-400 animate-pulse" />}
            <p className="text-slate-400 text-sm font-medium">
              {settings.isListening ? `Waiting for "${settings.triggerPhrase}"` : 'Protection currently paused'}
            </p>
          </div>
        </div>
      </div>

      {isEmergency && (
        <div className="bg-red-600/90 backdrop-blur-md p-6 rounded-3xl border border-red-400/50 flex flex-col items-center gap-4 animate-in zoom-in">
          <div className="bg-white p-2 rounded-full text-red-600">
            <AlertCircle size={32} />
          </div>
          <div className="text-center">
            <h4 className="font-black text-xl text-white">EMERGENCY BROADCASTING</h4>
            <p className="text-sm text-red-100 font-bold uppercase tracking-widest mt-1 flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" /> Live Location Sharing Active
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-2xl text-red-500 text-xs font-bold flex items-center gap-3">
          <AlertTriangle size={20} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-800 flex flex-col justify-between h-32">
          <Users size={20} className="text-slate-500" />
          <div>
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Contacts</span>
            <div className="text-2xl font-black text-white">{settings.contacts.length}</div>
          </div>
        </div>
        <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-800 flex flex-col justify-between h-32">
          <MapPin size={20} className={currentCoords ? 'text-blue-400' : 'text-slate-500'} />
          <div>
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">GPS Status</span>
            <div className={`text-lg font-black ${currentCoords ? 'text-blue-400' : 'text-slate-500'}`}>
              {currentCoords ? 'Live Tracking' : 'Searching...'}
            </div>
          </div>
        </div>
      </div>

      <button 
        onClick={triggerAlert}
        className="w-full py-5 bg-slate-800/50 border border-slate-700 rounded-3xl text-slate-400 text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
      >
        Manual Test Trigger
      </button>
    </div>
  );
};

export default Dashboard;
