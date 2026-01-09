import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getPreciseCurrentPosition,
  startLocationWatch,
  stopLocationWatch,
  uploadLiveLocation
} from '../services/LocationServices';
import { auth } from '../services/firebase';
import { GeminiService } from '../services/geminiService';
import { AlertLog, AppSettings, User as AppUser, GuardianCoords, SafeSpot } from '../types';

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
  const [recognitionStatus, setRecognitionStatus] = useState('Stopped');
  const [lastHeard, setLastHeard] = useState('');
  const [locationDenied, setLocationDenied] = useState(false);
  const watchIdRef = useRef<number>(-1);

  /* ================= SYSTEM CHECK ================= */

  const runSystemCheck = useCallback(async () => {
    setErrorMsg("RUNNING SYSTEM DIAGNOSTICS...");
    setLocationDenied(false);

    if (!navigator.geolocation) {
      setErrorMsg("⚠️ GEOLOCATION NOT SUPPORTED.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: Date.now()
        });
        setErrorMsg(null);
      },
      (err) => {
        if (err.code === 1) {
          setLocationDenied(true);
          setErrorMsg("⚠️ GPS ACCESS DENIED.");
        } else {
          setErrorMsg(`⚠️ GPS ERROR: ${err.message}`);
        }
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, []);

  /* ================= SOS ================= */

  const triggerSOS = async (reason: string) => {
    setErrorMsg("DISPATCHING SOS SIGNAL...");

    if (!auth.currentUser) {
      setErrorMsg("⚠️ AUTH ERROR: PLEASE LOGIN AGAIN.");
      return;
    }

    try {
      const loc = await getPreciseCurrentPosition();
      setCoords(loc);
      setLocationDenied(false);

      await uploadLiveLocation(loc, true);

      const timestamp = Date.now();
      const log: AlertLog = {
        id: `alert_${timestamp}`,
        senderEmail: user.email,
        senderName: user.name,
        timestamp,
        location: loc,
        message: reason,
        isLive: true,
        recipients: settings.contacts?.map(c => c.email) || []
      };

      onAlert(log);
      setErrorMsg(null);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "⚠️ SOS FAILED");
    }
  };

  /* ================= LOCATION WATCH ================= */

  useEffect(() => {
    watchIdRef.current = startLocationWatch(
      (c) => {
        setCoords(c);
        setLocationDenied(false);

        if (auth.currentUser) {
          uploadLiveLocation(c, isEmergency).catch(() => {});
        }

        findSafeSpots(c.lat, c.lng);
      },
      (err) => {
        if (err.includes("Permission")) setLocationDenied(true);
      }
    );

    return () => stopLocationWatch(watchIdRef.current);
  }, [isEmergency]);

  /* ================= SAFE SPOTS ================= */

  const findSafeSpots = async (lat: number, lng: number) => {
    setIsSearching(true);
    try {
      const results = await GeminiService.getNearbySafeSpots(lat, lng);
      setSafeSpots(results);
    } finally {
      setIsSearching(false);
    }
  };

  /* ================= UI ================= */

  return (
    <div className="space-y-6 px-4">
      <button
        onClick={() => triggerSOS("Manual Alert Trigger")}
        className="bg-red-600 text-white px-6 py-4 rounded-full w-full font-black"
      >
        🚨 SEND SOS
      </button>

      {coords && (
        <div className="bg-slate-900 p-4 rounded-xl text-white">
          <div>Lat: {coords.lat.toFixed(6)}</div>
          <div>Lng: {coords.lng.toFixed(6)}</div>
        </div>
      )}

      {locationDenied && (
        <div className="text-red-500 font-bold">
          Location permission denied
        </div>
      )}

      {errorMsg && (
        <div className="text-amber-500 font-bold">
          {errorMsg}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
