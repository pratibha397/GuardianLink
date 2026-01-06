
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

const STATIC_SAFE_SPOTS: SafeSpot[] = [
  { name: "Central Police Station", uri: "https://www.google.com/maps/search/police+station" },
  { name: "City General Hospital", uri: "https://www.google.com/maps/search/hospital" },
  { name: "Fire Department #4", uri: "https://www.google.com/maps/search/fire+station" },
  { name: "Emergency Medical Center", uri: "https://www.google.com/maps/search/emergency+medical" }
];

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
   * Explicitly requests core permissions for hardware access.
   */
  const requestCorePermissions = async (): Promise<boolean> => {
    try {
      console.log("Requesting Microhpone & Location Permissions...");
      // Check for Microphone
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Check for Location Access
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          (err) => {
            console.warn("Location permission check failed", err);
            resolve(false);
          },
          { enableHighAccuracy: false, timeout: 5000 }
        );
      });
    } catch (e) {
      console.warn("Permission request error", e);
      return false;
    }
  };

  /**
   * Broadcasts coordinates to every guardian. 
   * Verifies database writes with logging.
   */
  const broadcastLocationToAllGuardians = async (preciseCoords: GuardianCoords, reason: string) => {
    const contacts = settings.contacts || [];
    if (contacts.length === 0) {
      console.warn("SOS active but no Guardians are configured in Settings.");
      return;
    }

    console.log(`Broadcasting SOS to ${contacts.length} Guardians...`);

    for (const contact of contacts) {
      const email1 = user.email.toLowerCase().trim();
      const email2 = contact.email.toLowerCase().trim();
      const sorted = [email1, email2].sort();
      const sanitize = (e: string) => e.replace(/[\.\#\$\/\[\]]/g, '_');
      const path = `direct_chats/${sanitize(sorted[0])}__${sanitize(sorted[1])}`;

      const msg: ChatMessage = {
        id: `sos_dispatch_${Date.now()}_${sanitize(contact.email)}`,
        type: 'location',
        senderName: user.name,
        senderEmail: user.email,
        text: `🚨 SOS ALERT TRIGGERED: ${reason.toUpperCase()} 🚨`,
        lat: preciseCoords.lat,
        lng: preciseCoords.lng,
        timestamp: Date.now()
      };

      try {
        const msgRef = push(ref(rtdb, `${path}/updates`));
        await set(msgRef, msg);
        console.log(`✅ SOS successfully written to Mesh Node: ${contact.email}`);
      } catch (e) {
        console.error(`❌ Failed to write SOS to Node: ${contact.email}`, e);
      }
    }
  };

  // High-Frequency Mesh Synchronizer
  useEffect(() => {
    watchIdRef.current = startLocationWatch(
      (c: GuardianCoords) => {
        setCoords(c);
        setErrorMsg(null);
        if (externalActiveAlertId) {
          set(ref(rtdb, `alerts/${externalActiveAlertId}/location`), c).catch(() => {});
        }
      },
      (err: string) => {
        setErrorMsg(err);
      }
    );

    // Initial load of safety spots
    setSafeSpots(STATIC_SAFE_SPOTS);

    return () => {
      if (watchIdRef.current !== -1) stopLocationWatch(watchIdRef.current);
    };
  }, [externalActiveAlertId]);

  // Voice recognition logic
  useEffect(() => {
    if (settings.isListening && !externalActiveAlertId) {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }

        const recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (e: any) => {
          if (isTriggeringRef.current) return;
          const transcript = Array.from(e.results)
            .map((r: any) => r[0].transcript)
            .join(' ').toLowerCase();

          const trigger = settings.triggerPhrase.toLowerCase().trim();
          if (transcript.includes(trigger)) {
            console.log(`Phrase Detected: Triggering SOS ("${trigger}")`);
            recognition.stop();
            triggerSOS(`Danger Phrase Detected: "${trigger}"`);
          }
        };

        recognition.onend = () => {
          // Restart listener if not in emergency
          if (settings.isListening && !externalActiveAlertId && !isTriggeringRef.current) {
            try { recognition.start(); } catch(e) {}
          }
        };

        recognition.onerror = (err: any) => {
          console.error("Speech Recognizer Error:", err.error);
          if (err.error === 'not-allowed') {
            setErrorMsg("Microphone Access Required for Voice Trigger.");
          }
        };

        try { 
          recognition.start();
          recognitionRef.current = recognition;
        } catch(e) {
          console.error("Could not start Speech Recognition engine", e);
        }
      }
    } else if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [settings.isListening, externalActiveAlertId, settings.triggerPhrase]);

  /**
   * Unified SOS Dispatch:
   * 1. Fetches Guaranteed Location (Fresh or Fallback)
   * 2. Broadcasts to Guardians
   * 3. Activates Global Alert Registry
   */
  const triggerSOS = async (reason: string) => {
    if (isTriggeringRef.current) return;
    isTriggeringRef.current = true;
    setErrorMsg("SOS TRIGGERED: Establishing Satellite Lock...");

    try {
      // 1. Force a high-accuracy coordinate fix
      let lockedCoords: GuardianCoords | null = null;
      try {
        console.log("Attempting fresh GPS fix for SOS...");
        lockedCoords = await getPreciseCurrentPosition(2); // 2 retries
      } catch (e) {
        console.warn("Fresh GPS fix timed out, falling back to last known location.", e);
        lockedCoords = coords; // Use whatever we have in state
      }

      if (!lockedCoords) {
        console.error("SOS Critical Failure: No location coordinates available.");
        setErrorMsg("Failed to acquire location. Alert aborted.");
        isTriggeringRef.current = false;
        return;
      }

      console.log(`Location Locked: ${lockedCoords.lat}, ${lockedCoords.lng}. Dispatching Mesh Alerts...`);
      setCoords(lockedCoords);
      setErrorMsg(null);

      const alertId = `alert_${user.id}_${Date.now()}`;
      const log: AlertLog = {
        id: alertId, 
        senderEmail: user.email, 
        senderName: user.name,
        timestamp: Date.now(), 
        location: lockedCoords, 
        message: reason,
        isLive: true, 
        recipients: (settings.contacts || []).map(c => c.email)
      };

      // 2. Transmit to global registry for alert tracking
      await set(ref(rtdb, `alerts/${alertId}`), log);
      console.log(`✅ Alert Registry Node Created: ${alertId}`);
      
      // 3. Transmit to individual Mesh nodes (Direct Chats)
      await broadcastLocationToAllGuardians(lockedCoords, reason);
      
      // 4. Update parent state
      onAlert(log);
    } catch (e) { 
      console.error("SOS Protocol Chain Failure:", e);
      setErrorMsg("SOS Signal Failure. Network node unreachable."); 
      isTriggeringRef.current = false;
    }
  };

  const toggleGuard = async () => {
    if (!settings.isListening) {
      const granted = await requestCorePermissions();
      if (!granted) {
        setErrorMsg("Safety features require active hardware permissions.");
        return;
      }
    }
    updateSettings({ isListening: !settings.isListening });
  };

  /**
   * Static list refresh - simple and non-map based.
   */
  const findSafeSpots = () => {
    setIsSearching(true);
    setTimeout(() => {
      setSafeSpots(STATIC_SAFE_SPOTS);
      setIsSearching(false);
    }, 500);
  };

  if (externalActiveAlertId) {
    return (
      <div className="space-y-6 flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
        <div className="bg-red-600 p-8 rounded-full shadow-2xl animate-pulse mb-6">
          <ShieldAlert size={60} className="text-white" />
        </div>
        <h2 className="text-3xl font-black uppercase text-white italic tracking-tighter">Emergency Alert Live</h2>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs max-w-xs">High-accuracy location is being broadcast to the mesh network.</p>
        <div className="mt-10 p-6 glass rounded-[2.5rem] w-full border-red-500/20 flex items-center gap-4 text-left">
           <Activity className="text-red-500" />
           <div>
             <p className="text-[10px] font-black uppercase text-slate-500">Broadcasting To</p>
             <p className="text-sm font-bold text-white">{(settings.contacts || []).length} Verified Guardians</p>
           </div>
        </div>
        <button 
          onClick={() => { onClearAlert(); window.location.reload(); }}
          className="mt-8 bg-slate-900 border border-white/10 px-8 py-4 rounded-full text-red-500 font-black uppercase tracking-widest text-[10px] hover:bg-slate-800"
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
          <button onClick={toggleGuard} className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all ${settings.isListening ? 'bg-blue-600 shadow-blue-600/40' : 'bg-slate-800'}`}>
            <Power size={40} className={settings.isListening ? 'text-white' : 'text-slate-600'} />
          </button>
        </div>
        <div className="mt-6 text-center">
          <h2 className="text-xl font-black uppercase text-white tracking-tight">{settings.isListening ? 'Guard Active' : 'Offline'}</h2>
          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest italic mt-1">{settings.isListening ? `Trigger: "${settings.triggerPhrase}"` : 'Tap to start protection'}</p>
        </div>
      </div>

      <div className="glass p-5 rounded-[2.5rem] border border-white/5 relative overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between mb-5 px-1">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500">
                 <Navigation size={18} />
              </div>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Satellite Link</h3>
                <div className="flex items-center gap-2 mt-0.5">
                   <div className={`w-1.5 h-1.5 rounded-full ${coords ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                      {coords ? 'High-Accuracy Fix' : 'Searching for signal...'}
                   </span>
                </div>
              </div>
           </div>
           {coords && (
             <a 
               href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
               target="_blank" rel="noopener noreferrer"
               className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-95 transition-all"
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
          <div className="text-lg font-black text-white mt-1 italic">Check-In</div>
        </div>
        <div onClick={() => triggerSOS("Manual Alert")} className="bg-red-950/20 border border-red-500/20 p-5 rounded-[2rem] cursor-pointer active:scale-95 transition-all">
          <ShieldAlert size={18} className="text-red-500 mb-3" />
          <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest">Emergency</p>
          <div className="text-lg font-black text-white uppercase italic mt-1">SOS Dispatch</div>
        </div>
      </div>

      <div className="glass rounded-[2rem] p-6 border border-white/5">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xs font-black uppercase tracking-widest italic text-white flex items-center gap-2">
            <Globe size={16} className="text-blue-500" /> Nearby Help
          </h3>
          <button onClick={findSafeSpots} disabled={isSearching} className="text-[9px] font-black text-blue-500 uppercase disabled:opacity-30">
            {isSearching ? 'Updating...' : 'Refresh List'}
          </button>
        </div>
        <div className="space-y-3">
          {safeSpots.map((spot, i) => (
            <a key={i} href={spot.uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-white/5 group">
              <span className="text-[11px] font-bold text-slate-400 group-hover:text-white transition-colors">{spot.name}</span>
              <ChevronRight size={14} className="text-slate-700 group-hover:text-blue-500 transition-colors" />
            </a>
          ))}
          {safeSpots.length === 0 && <p className="text-center text-[9px] text-slate-600 uppercase font-black py-4">No local safety nodes found</p>}
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
