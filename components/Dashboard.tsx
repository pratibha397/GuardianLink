
import { AlertTriangle, MapPin, MessageSquare, Power, Radio, Send, ShieldCheck, Users } from 'lucide-react';
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
  const [emergencyMessage, setEmergencyMessage] = useState('');
  const [broadcastLog, setBroadcastLog] = useState<string[]>([]);
  const monitorRef = useRef<GeminiVoiceMonitor | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Requirement: Only send to contacts registered in the app
  const registeredContacts = settings.contacts.filter(c => c.isRegisteredUser);

  useEffect(() => {
    if (settings.isListening || isEmergency) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos: GeolocationPosition) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentCoords(coords);
          if (isEmergency) updateGlobalAlert(coords);
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
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
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

  const triggerAlert = (customMsg?: string) => {
    // Only proceed if there are registered contacts to receive the broadcast
    if (registeredContacts.length === 0) {
      setError("Guardian Link blocked: No registered guardians found in your network. Add them in Setup and enable 'App Registered'.");
      return;
    }

    const coords = currentCoords;
    const locationStr = coords ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}` : 'Location unavailable';
    const message = customMsg || settings.messageTemplate.replace('{location}', locationStr);
    
    // FIX: Explicitly including senderName to satisfy AlertLog interface
    const newLog: AlertLog = {
      id: Date.now().toString(),
      senderPhone: user.phone,
      senderName: user.name, 
      timestamp: Date.now(),
      location: coords,
      message,
      isLive: true,
      recipients: registeredContacts.map((c: EmergencyContact) => `${c.name} (${c.phone})`)
    };

    onAlertTriggered(newLog);
    if (customMsg) setBroadcastLog(prev => [`[${new Date().toLocaleTimeString()}] ${customMsg}`, ...prev]);
  };

  const sendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emergencyMessage.trim()) return;
    triggerAlert(emergencyMessage);
    setEmergencyMessage('');
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
      {!isEmergency ? (
        <div className={`p-8 rounded-[2.5rem] flex flex-col items-center justify-center transition-all duration-700 border-2 ${
          settings.isListening 
            ? 'bg-blue-600/10 border-blue-500/50 shadow-[0_0_80px_-20px_rgba(59,130,246,0.5)]' 
            : 'bg-slate-800/50 border-slate-700/50'
        }`}>
          <button onClick={toggleListening} className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all active:scale-90 group ${settings.isListening ? 'bg-blue-600 shadow-xl' : 'bg-slate-700 shadow-inner'}`}>
            {settings.isListening && <div className="absolute inset-0 rounded-full animate-ping bg-blue-400/20" />}
            <Power size={48} className={settings.isListening ? 'text-white' : 'text-slate-500'} />
          </button>
          <div className="mt-8 text-center space-y-2">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">
              {settings.isListening ? 'Link Secured' : 'System Offline'}
            </h2>
            <div className="flex items-center gap-2 justify-center">
              {settings.isListening && <Radio size={14} className="text-blue-400 animate-pulse" />}
              <p className="text-slate-400 text-sm font-medium">
                {settings.isListening ? `Broadcasting on trigger: "${settings.triggerPhrase}"` : 'Guardian protection is currently paused'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-in zoom-in slide-in-from-top-4 duration-500">
          <div className="bg-blue-700 p-6 rounded-[2.5rem] shadow-2xl shadow-blue-900/40 border border-blue-500/50 relative overflow-hidden">
             <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
             <div className="flex items-center gap-4 mb-4">
                <div className="bg-white p-2 rounded-2xl text-blue-700 shadow-lg">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h4 className="font-black text-lg text-white leading-none">Guardian Link Live</h4>
                  <p className="text-[10px] text-blue-100 font-black uppercase tracking-widest mt-1">Encrypted Safety Channel</p>
                </div>
             </div>
             
             {/* Requirement: Message box for live updates only via Guardian Link */}
             <form onSubmit={sendBroadcast} className="relative mt-6 group">
                <input 
                  type="text" 
                  value={emergencyMessage}
                  onChange={(e) => setEmergencyMessage(e.target.value)}
                  placeholder="Send live status to registered guardians..."
                  className="w-full bg-black/30 border border-white/30 rounded-2xl py-4 pl-5 pr-14 text-white placeholder:text-blue-200 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm transition-all shadow-inner"
                />
                <button 
                  type="submit" 
                  disabled={!emergencyMessage.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white text-blue-700 rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shadow-lg"
                >
                  <Send size={18} />
                </button>
             </form>
          </div>

          {broadcastLog.length > 0 && (
            <div className="bg-slate-800/40 p-5 rounded-[2.2rem] border border-slate-800 space-y-3 shadow-xl">
              <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <MessageSquare size={12} /> Live App Broadcast Feed
              </h5>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                {broadcastLog.map((msg, i) => (
                  <div key={i} className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300 animate-in slide-in-from-bottom-2 leading-relaxed">
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 p-5 rounded-3xl text-red-500 text-xs font-bold flex items-center gap-4 animate-in slide-in-from-bottom-2">
          <AlertTriangle size={24} className="shrink-0" />
          <span className="leading-tight">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/40 p-6 rounded-[2rem] border border-slate-800 flex flex-col justify-between h-36 hover:bg-slate-800/60 transition-colors">
          <Users size={20} className={registeredContacts.length > 0 ? 'text-blue-400' : 'text-slate-600'} />
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Linked Guardians</span>
            <div className="text-3xl font-black text-white leading-none mt-1">{registeredContacts.length}</div>
          </div>
        </div>
        <div className="bg-slate-800/40 p-6 rounded-[2rem] border border-slate-800 flex flex-col justify-between h-36 hover:bg-slate-800/60 transition-colors">
          <MapPin size={20} className={currentCoords ? 'text-blue-400' : 'text-slate-600'} />
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Signal Quality</span>
            <div className={`text-xl font-black mt-1 ${currentCoords ? 'text-blue-400' : 'text-slate-500'}`}>
              {currentCoords ? 'Optimal' : 'Connecting...'}
            </div>
          </div>
        </div>
      </div>

      {!isEmergency && (
        <button 
          onClick={() => triggerAlert()} 
          className="w-full py-5 bg-blue-600/5 border border-blue-500/20 rounded-[1.8rem] text-blue-500 text-[10px] font-black uppercase tracking-widest hover:bg-blue-600/10 hover:border-blue-500/40 transition-all flex items-center justify-center gap-2"
        >
          <ShieldCheck size={14} /> Send Link Test Alert
        </button>
      )}
    </div>
  );
};

export default Dashboard;
