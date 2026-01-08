
import { GuardianCoords } from '../types';

const STORAGE_KEY = 'guardian_last_known_loc';

// In-memory cache
let lastCapturedCoords: GuardianCoords | null = null;

// Initialize cache from Session Storage to prevent "---" on page reload
try {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    // Accept cache if it's less than 30 minutes old for UI purposes
    if (Date.now() - parsed.timestamp < 1800000) {
      lastCapturedCoords = parsed;
    }
  }
} catch (e) {
  // Ignore storage errors
}

const saveLocation = (coords: GuardianCoords) => {
  lastCapturedCoords = coords;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
  } catch (e) {}
};

const formatCoords = (pos: GeolocationPosition): GuardianCoords => ({
  lat: pos.coords.latitude,
  lng: pos.coords.longitude,
  accuracy: pos.coords.accuracy,
  speed: pos.coords.speed,
  heading: pos.coords.heading,
  timestamp: pos.timestamp
});

/**
 * Continuous background watch.
 * OPTIMIZED: Starts with instant cache return, then updates with fresh data.
 */
export function startLocationWatch(
  onUpdate: (coords: GuardianCoords) => void,
  onError: (message: string) => void
): number {
  if (!navigator.geolocation) {
    onError("GPS Hardware Missing");
    return -1;
  }

  // 1. FAST PATH: Return cached data immediately so UI isn't empty
  if (lastCapturedCoords) {
    onUpdate(lastCapturedCoords);
  }

  // 2. Start Watcher
  // We use maximumAge: 0 to force fresh data eventually, but rely on cache for instant start
  return navigator.geolocation.watchPosition(
    (pos) => {
      const coords = formatCoords(pos);
      saveLocation(coords);
      onUpdate(coords);
    },
    (error) => {
      console.warn("GPS Watch Error:", error.message);
      if (error.code === 1) onError("Location Permission Denied");
      else if (error.code === 2) onError("Location Unavailable");
      else if (error.code === 3) onError("GPS Signal Weak");
    },
    { 
      enableHighAccuracy: true, 
      maximumAge: 10000, // Accept 10s old data to reduce battery drain and latency
      timeout: 15000 
    }
  );
}

/**
 * Robust SOS Coordinate Resolver.
 * STRATEGY: Race High Accuracy vs Time. Fallback to Low Accuracy, then Cache.
 */
export async function getPreciseCurrentPosition(): Promise<GuardianCoords> {
  // 1. If we have a very recent location (fresh within 10s), just use it.
  if (lastCapturedCoords && (Date.now() - lastCapturedCoords.timestamp < 10000)) {
    return lastCapturedCoords;
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("No GPS Hardware"));
      return;
    }

    let isResolved = false;

    const handleSuccess = (pos: GeolocationPosition) => {
      if (isResolved) return;
      isResolved = true;
      const coords = formatCoords(pos);
      saveLocation(coords);
      resolve(coords);
    };

    const handleError = (primaryError: GeolocationPositionError) => {
      if (isResolved) return;
      
      // Primary High-Accuracy request failed. 
      // Fallback Strategy: Try Low Accuracy (Cell/Wifi) which is faster and more reliable indoors.
      console.warn("High Accuracy GPS timed out/failed. Switching to Network Location.");
      
      navigator.geolocation.getCurrentPosition(
        (pos) => handleSuccess(pos),
        (secondaryError) => {
          if (isResolved) return;
          isResolved = true;
          
          // Final Safety Net: If both failed, return the last known cache if it exists (better than nothing for SOS)
          if (lastCapturedCoords) {
            console.warn("All location methods failed. Returning last known cache.");
            resolve(lastCapturedCoords);
          } else {
            const msg = secondaryError.code === 1 ? "Permission Denied" : "Location Signal Lost";
            reject(new Error(msg));
          }
        },
        { 
          enableHighAccuracy: false, 
          timeout: 10000, 
          maximumAge: Infinity // Accept ANY cached location the OS has
        }
      );
    };

    // Step 1: Try High Accuracy with a short timeout (5s)
    // We want speed. If GPS doesn't lock in 5s, we degrade to Wifi/Cell.
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      { 
        enableHighAccuracy: true, 
        timeout: 5000, 
        maximumAge: 5000 
      }
    );
  });
}

export function stopLocationWatch(watchId: number): void {
  if (watchId !== -1) navigator.geolocation.clearWatch(watchId);
}
