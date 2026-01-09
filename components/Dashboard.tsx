import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Flame,
  Globe,
  Hospital,
  MapPinOff,
  Mic,
  MicOff,
  Navigation,
  Scan,
  Search,
  Shield,
  ShieldAlert,
  Timer,
  Volume2,
  X
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertLog, AppSettings, User as AppUser, EmergencyContact, GuardianCoords, SafeSpot } from '../types';
// Re-importing to ensure path resolution works
import GuardianService from '../services/GuardianService';
import { getPreciseCurrentPosition, startLocationWatch, stopLocationWatch } from '../services/LocationServices';
import { push, ref, rtdb, set } from '../services/firebase';
import { GeminiService } from '../services/geminiService';

interface DashboardProps {
  user: AppUser;
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
  isEmergency: boolean;
  onAlert: (log: AlertLog) => void;
  externalActiveAlertId: string | null;
  onClearAlert: () => void;
}

const TIMER_STORAGE_KEY = 'guardian_timer_target_v1';

const Dashboard: React.FC<DashboardProps> = ({ 
  user, 
  settings, 
  updateSettings, 
  isEmergency, 
  onAlert, 
  externalActiveAlertId, 
  onClearAlert 
}) => {
  const [coords, setCoords] = useState<GuardianCoords | null>(null);
  const [safeSpots, setSafeSpots] = useState<SafeSpot[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recognitionStatus, setRecognitionStatus] = useState<string>('Stopped');
  const [lastHeard, setLastHeard] = useState<string>('');
  const [locationDenied, setLocationDenied] = useState(false);
  const watchIdRef = useRef<number>(-1);

  // Timer State
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [customTimerMinutes, setCustomTimerMinutes] = useState('');
  const [timerTarget, setTimerTarget] = useState<number | null>(() => {
    const saved = localStorage.getItem(TIMER_STORAGE_KEY);
    return saved ? parseInt(saved) : null;
  });
  const [timeLeftStr, setTimeLeftStr] = useState("");

  // Refs to avoid stale closures in Timer/Interval
  const userRef = useRef(user);
  const settingsRef = useRef(settings);
  
  useEffect(() => {
    userRef.current = user;
    settingsRef.current = settings;
  }, [user, settings]);

  /**
   * ROBUST SYSTEM PERMISSION CHECK (Requested Script)
   * Requests Notifications + Geolocation and sends a test alert.
   */
  const runSystemCheck = useCallback(async () => {
    setErrorMsg("RUNNING SYSTEM DIAGNOSTICS...");
    setLocationDenied(false);
    
    // 1. Request Notification Permission
    let notifPermission = 'default';
    if ('Notification' in window) {
      notifPermission = Notification.permission;
      if (notifPermission !== 'granted') {
        notifPermission = await Notification.requestPermission();
        if (notifPermission !== 'granted') {
           // We don't block on this, just warn
           console.warn("Notification permission denied");
        }
      }
    }

    // 2. Request Geolocation & Send Notification
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // Success: Get Location
          const { latitude, longitude } = pos.coords;
          setCoords({
            lat: latitude,
            lng: longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp
          });
          
          // 3. Send Notification with Location
          if (notifPermission === 'granted') {
            try {
              new Notification("Aegis System Verification", {
                body: `System Active. Location Secured: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                icon: 'https://cdn-icons-png.flaticon.com/512/1063/1063376.png'
              });
            } catch (e) {
              console.error("Notification trigger failed", e);
            }
          }
          
          setErrorMsg(null);
        },
        (err) => {
          // 4. Critical Error Handling for Geolocation
          // Error Code 1 is PERMISSION_DENIED
          if (err.code === 1 || err.message.toLowerCase().includes('denied')) { 
             setLocationDenied(true);
             setErrorMsg("⚠️ GPS ACCESS DENIED. PLEASE ENABLE LOCATION PERMISSIONS IN YOUR BROWSER SETTINGS.");
          } else if (err.code === 2) { 
             setErrorMsg("⚠️ GPS SIGNAL UNAVAILABLE. CHECK CONNECTION.");
          } else if (err.code === 3) { 
             setErrorMsg("⚠️ GPS TIMEOUT. TRY AGAIN OUTSIDE.");
          } else {
             setErrorMsg(`⚠️ GPS ERROR: ${err.message}`);
          }
        },
        { enableHighAccuracy: true, timeout: 12000 }
      );
    } else {
      setErrorMsg("⚠️ GEOLOCATION NOT SUPPORTED BY DEVICE.");
    }
  }, []);

  // Resilient SOS Trigger
  const triggerSOS = async (reason: string) => {
    setErrorMsg("DISPATCHING SOS SIGNAL...");
    
    // Use refs if called from timer to ensure fresh data
    const currentUser = userRef.current;
    const currentSettings = settingsRef.current;

    let loc: GuardianCoords | null = null;
    let gpsErrorString: string | null = null;

    // 1. Try to get Location (Best Effort)
    try {
      loc = await getPreciseCurrentPosition();
      setCoords(loc);
      setLocationDenied(false);
    } catch (gpsErr: any) {
      console.warn("SOS: GPS Failed, proceeding without location.", gpsErr);
      gpsErrorString = gpsErr.message || "GPS Permission Denied";
      if (gpsErr.code === 1 || gpsErr.message?.toLowerCase().includes('denied')) {
        setLocationDenied(true);
      }
      // We do NOT stop the SOS. We proceed with null location.
    }

    try {
      const guardians = currentSettings.contacts || [];
      if (guardians.length === 0) throw new Error("Add contacts in Settings to enable SOS.");

      const timestamp = Date.now();
      
      // 2. Prepare Payload
      const locationText = loc 
        ? `[${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}]` 
        : `[UNKNOWN LOCATION - ${gpsErrorString || "GPS Failed"}]`;
        
      const alertMessage = `🚨 EMERGENCY ALERT: ${locationText} - ${reason} 🚨`;

      const broadcastTasks = guardians.map((guardian: EmergencyContact) => {
        const sorted = [currentUser.email.toLowerCase(), guardian.email.toLowerCase()].sort();
        const sanitize = (e: string) => e.replace(/[\.\#\$\/\[\]]/g, '_');
        const combinedId = `${sanitize(sorted[0])}__${sanitize(sorted[1])}`;
        
        return push(ref(rtdb, `direct_chats/${combinedId}/updates`), {
          id: `sos_${timestamp}_${guardian.id}`,
          type: 'location',
          senderName: currentUser.name,
          senderEmail: currentUser.email.toLowerCase(),
          text: alertMessage,
          lat: loc?.lat || 0,
          lng: loc?.lng || 0,
          timestamp: timestamp
        });
      });
      await Promise.all(broadcastTasks);

      const alertId = `alert_${currentUser.id}_${timestamp}`;
      const log: AlertLog = {
        id: alertId, 
        senderEmail: currentUser.email, 
        senderName: currentUser.name,
        timestamp: timestamp, 
        location: loc, 
        message: reason, 
        isLive: true, 
        recipients: guardians.map(c => c.email)
      };
      await set(ref(rtdb, `alerts/${alertId}`), log);
      onAlert(log);

      // Check specific outcomes
      if (!loc) {
        setErrorMsg("⚠️ ALERT SENT WITHOUT GPS. ENABLE BROWSER LOCATION PERMISSIONS.");
      } else {
        setErrorMsg(null);
      }

    } catch (err: any) {
      console.error("Critical SOS Failure:", err);
      // Cleanly distinguish between GPS errors (already handled above) and DB errors
      const msg = err.message ? err.message.toLowerCase() : "";
      if (err.code === 'PERMISSION_DENIED' || err.code === 'permission-denied' || msg.includes("permission denied")) {
         setErrorMsg("⚠️ FAILED: DATABASE ACCESS DENIED. CHECK FIREBASE RULES/AUTH.");
      } else {
         setErrorMsg("⚠️ ALERT FAILED: " + (err.message || "Unknown Error"));
      }
    }
  };

  // Keep a ref to the trigger function so setInterval calls the latest version
  const triggerSOSRef = useRef(triggerSOS);
  useEffect(() => {
    triggerSOSRef.current = triggerSOS;
  });

  // Timer Logic
  useEffect(() => {
    if (!timerTarget) {
      setTimeLeftStr("");
      localStorage.removeItem(TIMER_STORAGE_KEY);
      if (settings.isTimerActive) {
         updateSettings({ isTimerActive: false });
      }
      return;
    }

    // Ensure WakeLock is active
    if (!settings.isTimerActive) {
      updateSettings({ isTimerActive: true });
    }

    localStorage.setItem(TIMER_STORAGE_KEY, timerTarget.toString());

    const interval = setInterval(() => {
      const diff = Math.ceil((timerTarget - Date.now()) / 1000);
      
      if (diff <= 0) {
        setTimerTarget(null);
        // Call via ref to avoid stale closure
        triggerSOSRef.current("SAFETY TIMER EXPIRED - USER DID NOT CHECK IN");
      } else {
        const m = Math.floor(diff / 60);
        const s = diff % 60;
        setTimeLeftStr(`${m}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timerTarget, settings.isTimerActive, updateSettings]);

  const startTimer = (minutes: number) => {
    if (minutes <= 0) return;
    const target = Date.now() + (minutes * 60 * 1000);
    setTimerTarget(target);
    setShowTimerModal(false);
    setCustomTimerMinutes('');
  };

  const cancelTimer = () => {
    setTimerTarget(null);
  };

  useEffect(() => {
    if (settings.isListening) {
      GuardianService.start(user, settings, (status: string, heard: string) => {
        setRecognitionStatus(status || 'Listening...');
        setLastHeard(heard || '');
      }, (log: AlertLog) => onAlert(log));
    } else {
      GuardianService.stop();
      setRecognitionStatus('Stopped');
    }
  }, [settings.isListening, user, settings, onAlert]);

  const findSafeSpots = async (lat: number, lng: number) => {
    setIsSearching(true);
    try {
      const results = await GeminiService.getNearbySafeSpots(lat, lng);
      setSafeSpots(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    watchIdRef.current = startLocationWatch((c: GuardianCoords) => {
      setCoords(c);
      setLocationDenied(false);
      if (externalActiveAlertId) {
        set(ref(rtdb, `alerts/${externalActiveAlertId}/location`), c).catch(() => {});
      }
      findSafeSpots(c.lat, c.lng);
    }, (err: string) => {
      console.warn("Background GPS Watch:", err);
      if (err.includes('Permission')) setLocationDenied(true);
    });
    
    return () => stopLocationWatch(watchIdRef.current);
  }, [externalActiveAlertId]);

  if (externalActiveAlertId || isEmergency) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in px-6">
        <div className="bg-red-600 p-10 rounded-full shadow-[0_0_60px_rgba(239,68,68,0.5)] animate-pulse mb-8">
          <ShieldAlert size={64} className="text-white" />
        </div>
        <h2 className="text-3xl font-black uppercase text-white italic tracking-tighter">Emergency Broadcast</h2>
        <button 
          onClick={() => { onClearAlert(); window.location.reload(); }}
          className="mt-14 bg-slate-900 border border-white/10 px-14 py-5 rounded-full text-red-500 font-black uppercase tracking-widest text-[10px]"
        >
          <X size={14} className="inline mr-2" /> Deactivate Aegis
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700 relative">
      {/* Timer Modal */}
      {showTimerModal && (
        <div className="fixed inset-0 z-50 bg-[#020617]/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowTimerModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white"><X size={24}/></button>
            <div className="flex flex-col items-center mb-6">
              <Timer size={42} className="text-blue-500 mb-3" />
              <h3 className="text-xl font-black uppercase italic text-white">Set Safety Timer</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center mt-2">
                If timer expires without check-in, SOS is triggered automatically.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[5, 15, 30, 60].map(min => (
                <button 
                  key={min} 
                  onClick={() => startTimer(min)}
                  className="bg-slate-800 hover:bg-blue-600 hover:text-white transition-all p-4 rounded-2xl text-sm font-black text-slate-300 border border-white/5 active:scale-95"
                >
                  {min} MIN
                </button>
              ))}
            </div>
            <div className="relative">
              <input 
                type="number" 
                placeholder="Custom Minutes"
                value={customTimerMinutes}
                onChange={(e) => setCustomTimerMinutes(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white font-bold outline-none focus:border-blue-500"
              />
              {customTimerMinutes && (
                <button 
                  onClick={() => startTimer(parseInt(customTimerMinutes))}
                  className="absolute right-2 top-1.5 bottom-1.5 bg-blue-600 px-4 rounded-xl text-[10px] font-black uppercase text-white hover:bg-blue-500 transition-colors"
                >
                  Start
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="glass p-5 rounded-[2.5rem] border border-white/5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Volume2 size={16} className={recognitionStatus?.includes('Listening') ? 'text-blue-500 animate-pulse' : 'text-slate-600'} />
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest italic">Aegis Service</h3>
          </div>
          <button 
             onClick={runSystemCheck} 
             className="text-[8px] font-black uppercase px-3 py-1 rounded-full bg-slate-800 text-slate-400 hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-1"
          >
             <Scan size={10} /> Test System
          </button>
        </div>
        <div className="bg-slate-950/80 rounded-2xl p-4 min-h-[70px] flex items-start gap-4 border border-white/5">
           {recognitionStatus?.includes('Listening') ? <Mic size={16} className="text-blue-500 shrink-0 mt-1" /> : <MicOff size={16} className="text-slate-700 shrink-0 mt-1" />}
           <div className="flex-1">
              <p className="text-[10px] font-black uppercase text-slate-700 tracking-widest mb-1 italic">Status Box:</p>
              <p className="text-xs font-bold text-slate-300 leading-snug italic line-clamp-2">
                {recognitionStatus === 'Listening...' ? `Heard: ${lastHeard || '...'}` : `System is ${recognitionStatus}`}
              </p>
           </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-4">
        <div className={`neural-ring ${settings.isListening ? 'active' : ''}`}>
          {settings.isListening && <><div className="ring-layer" /><div className="ring-layer" style={{animationDelay: '1s'}}/></>}
          <button onClick={() => updateSettings({ isListening: !settings.isListening })} className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all ${settings.isListening ? 'bg-blue-600 shadow-[0_0_50px_rgba(37,99,235,0.4)] scale-105' : 'bg-slate-800 shadow-xl border border-white/5'}`}>
            <Shield size={42} className={settings.isListening ? 'text-white' : 'text-slate-700'} />
          </button>
        </div>
        <div className="mt-8 text-center">
          <h2 className="text-xl font-black uppercase text-white tracking-tight italic">{settings.isListening ? 'Protection Active' : 'Standby'}</h2>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2 italic">
            {settings.isListening ? `Phrase: "${settings.triggerPhrase}"` : 'Touch shield to activate safety mesh'}
          </p>
        </div>
      </div>

      <div className="glass p-6 rounded-[2.5rem] border border-white/5 relative overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between mb-6">
           <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600/10 rounded-xl text-blue-500"><Navigation size={18} /></div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Live Telemetry</h3>
           </div>
           {coords && <a href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`} target="_blank" rel="noreferrer" className="p-3 bg-blue-600 text-white rounded-2xl"><ExternalLink size={14} /></a>}
        </div>
        <div className="grid grid-cols-2 gap-4">
           <div className="bg-slate-950 p-4 rounded-2xl border border-white/5">
              <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest block mb-1">Latitude</span>
              <span className="text-sm font-bold text-white mono">{coords ? coords.lat.toFixed(6) : '---.------'}</span>
           </div>
           <div className="bg-slate-950 p-4 rounded-2xl border border-white/5">
              <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest block mb-1">Longitude</span>
              <span className="text-sm font-bold text-white mono">{coords ? coords.lng.toFixed(6) : '---.------'}</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Safety Timer UI: Active vs Inactive */}
        {timerTarget ? (
           <div className="glass p-5 rounded-[2rem] border border-blue-500/30 flex flex-col items-center bg-blue-900/10 shadow-[0_0_20px_rgba(37,99,235,0.1)]">
             <div className="text-2xl font-black text-blue-400 mono animate-pulse mb-1">{timeLeftStr}</div>
             <p className="text-[8px] font-bold text-blue-300 uppercase tracking-widest mb-3">Timer Active</p>
             <button onClick={cancelTimer} className="bg-green-600 text-[9px] font-bold px-4 py-2 rounded-full text-white hover:bg-green-500 transition-colors shadow-lg active:scale-95 flex items-center gap-1">
               <CheckCircle2 size={12} /> I'M SAFE (CANCEL)
             </button>
           </div>
        ) : (
          <button onClick={() => setShowTimerModal(true)} className="glass p-5 rounded-[2rem] border border-white/5 flex flex-col items-center cursor-pointer hover:bg-slate-800/50 transition-colors group">
            <Timer size={18} className="text-blue-500 mb-3 group-hover:scale-110 transition-transform" />
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest italic group-hover:text-white transition-colors">Safety Timer</p>
          </button>
        )}

        <button onClick={() => triggerSOS("Manual Alert Trigger")} className="bg-red-950/20 border border-red-500/20 p-5 rounded-[2rem] cursor-pointer flex flex-col items-center shadow-xl active:scale-95 transition-transform hover:bg-red-900/30">
          <ShieldAlert size={18} className="text-red-500 mb-3" />
          <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest italic">Instant Signal</p>
        </button>
      </div>

      <div className="glass rounded-[2.5rem] p-6 border border-white/5 shadow-2xl pb-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xs font-black uppercase tracking-widest italic text-white flex items-center gap-2">
            <Globe size={16} className="text-blue-500" /> Nearby Safety
          </h3>
          <button onClick={() => coords && findSafeSpots(coords.lat, coords.lng)} disabled={isSearching || !coords} className="text-[9px] font-black text-blue-500 uppercase bg-blue-500/10 px-4 py-2 rounded-full disabled:opacity-30">
            {isSearching ? 'Scanning...' : 'Update'}
          </button>
        </div>
        <div className="space-y-3">
          {safeSpots.map((spot: SafeSpot, i: number) => (
            <a key={i} href={spot.uri} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 bg-slate-950/60 border border-white/5 rounded-2xl hover:bg-slate-900 transition-colors">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-500 shrink-0">
                    {spot.category === 'Police' ? <Building2 size={16}/> : spot.category === 'Fire Department' ? <Flame size={16}/> : spot.category === 'Hospital' ? <Hospital size={16}/> : <Search size={16}/>}
                 </div>
                 <div className="text-[11px] font-bold text-slate-200 uppercase italic truncate max-w-[150px]">{spot.name}</div>
              </div>
              <div className="text-[9px] font-black text-slate-600 uppercase italic whitespace-nowrap bg-slate-900 px-3 py-1.5 rounded-xl">
                {spot.distance}
              </div>
            </a>
          ))}
          {safeSpots.length === 0 && (
            <div className="text-center py-8">
               {locationDenied ? (
                 <div className="flex flex-col items-center gap-2 text-amber-500">
                    <MapPinOff size={24} />
                    <p className="text-[9px] uppercase font-black italic">Location Access Denied</p>
                    <button onClick={runSystemCheck} className="text-[8px] font-bold bg-amber-500/10 px-3 py-1 rounded-full hover:bg-amber-500 hover:text-white transition-colors">Retry Permission</button>
                 </div>
               ) : (
                 <p className="text-[9px] text-slate-700 uppercase font-black italic">
                   {isSearching ? 'Scanning neural network...' : coords ? 'No specific locations detected.' : 'Waiting for location signal...'}
                 </p>
               )}
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="relative p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[10px] font-black text-amber-500 uppercase tracking-widest text-center animate-pulse flex items-center justify-center gap-2 group">
           <AlertCircle size={14} className="shrink-0" /> <span className="max-w-[80%]">{errorMsg}</span>
           <button onClick={() => setErrorMsg(null)} className="absolute right-4 p-1 hover:text-white transition-colors"><X size={12} /></button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;