import { getAuth } from "firebase/auth";
import { getDatabase, ref, set } from "firebase/database";

export type GuardianCoords = {
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
};

const STORAGE_KEY = "guardian_last_known_loc";
let lastCapturedCoords: GuardianCoords | null = null;

/* ================= CACHE ================= */

try {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (Date.now() - parsed.timestamp < 1800000) {
      lastCapturedCoords = parsed;
    }
  }
} catch {}

/* ================= UTILS ================= */

const saveLocation = (coords: GuardianCoords) => {
  lastCapturedCoords = coords;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
  } catch {}
};

const formatCoords = (pos: GeolocationPosition): GuardianCoords => ({
  lat: pos.coords.latitude,
  lng: pos.coords.longitude,
  accuracy: pos.coords.accuracy,
  speed: pos.coords.speed ?? null,
  heading: pos.coords.heading ?? null,
  timestamp: Date.now()
});

/* ================= GPS WATCH ================= */

export function startLocationWatch(
  onUpdate: (coords: GuardianCoords) => void,
  onError: (message: string) => void
): number {
  if (!navigator.geolocation) {
    onError("GPS not supported");
    return -1;
  }

  if (lastCapturedCoords) onUpdate(lastCapturedCoords);

  return navigator.geolocation.watchPosition(
    (pos) => {
      const coords = formatCoords(pos);
      saveLocation(coords);
      onUpdate(coords);
    },
    (err) => {
      if (err.code === 1) onError("Permission Denied");
      else onError(err.message);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000
    }
  );
}

export function stopLocationWatch(id: number) {
  if (id !== -1) navigator.geolocation.clearWatch(id);
}

/* ================= SINGLE GPS FETCH ================= */

export async function getPreciseCurrentPosition(): Promise<GuardianCoords> {
  if (lastCapturedCoords && Date.now() - lastCapturedCoords.timestamp < 20000) {
    return lastCapturedCoords;
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = formatCoords(pos);
        saveLocation(coords);
        resolve(coords);
      },
      (err) => {
        if (err.code === 1) reject(new Error("Location Permission Denied"));
        else if (lastCapturedCoords) resolve(lastCapturedCoords);
        else reject(new Error("Unable to acquire location"));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );
  });
}

/* ================= FIREBASE WRITE ================= */

export async function uploadLiveLocation(
  coords: GuardianCoords,
  isEmergency: boolean
) {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User not authenticated");
  }

  const db = getDatabase();

  await set(ref(db, `liveLocations/${user.uid}`), {
    lat: coords.lat,
    lng: coords.lng,
    timestamp: coords.timestamp,
    isEmergency
  });
}
