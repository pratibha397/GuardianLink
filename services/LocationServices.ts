import { GuardianCoords } from '../types';

/**
 * Strategy: Fast-Path Priority.
 * We prioritize speed (cached) over precision (fresh) for the first few seconds of an emergency.
 */
let lastCapturedCoords: GuardianCoords | null = null;

/**
 * Continuous background watch to keep a 'warm' cache.
 */
export function startLocationWatch(
  onUpdate: (coords: GuardianCoords) => void,
  onError: (message: string) => void
): number {
  if (!navigator.geolocation) {
    onError("GPS Hardware Missing");
    return -1;
  }

  // OPTIMIZATION: Check if we already have a coordinate in memory to fire immediately.
  // This prevents the UI from showing "---" when switching views.
  if (lastCapturedCoords) {
    onUpdate(lastCapturedCoords);
  }

  // Using standard high accuracy options but allowing cached data for speed
  return navigator.geolocation.watchPosition(
    (position) => {
      const c = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        heading: position.coords.heading,
        timestamp: position.timestamp
      };
      
      // Update cache
      lastCapturedCoords = c;
      onUpdate(c);
    },
    (error) => {
      console.warn("Watch stream signal dip:", error.message);
      // Do not hard fail on temporary signal loss during watch
    },
    { 
      enableHighAccuracy: true, 
      maximumAge: 30000, // CRITICAL FIX: Allow positions up to 30s old to display INSTANTLY
      timeout: 20000 
    }
  );
}

/**
 * Robust SOS Coordinate Resolver.
 * Fixes "Signal Lost" bug by using standard timeouts and fallback logic.
 * OPTIMIZED: Returns immediately if cache is available.
 */
export async function getPreciseCurrentPosition(): Promise<GuardianCoords> {
  // FAST PATH: If we have a recent location from the watcher, return it immediately.
  // This eliminates the 5-10s delay when triggering SOS if the app is already open.
  if (lastCapturedCoords) {
    console.log("SOS Location: Using Instant Memory Cache");
    return lastCapturedCoords;
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("No GPS Hardware"));
      return;
    }

    // Attempt to get a fresh, high-accuracy position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: pos.timestamp
        };
        lastCapturedCoords = coords;
        console.log("SOS Location: Fresh Lock Acquired");
        resolve(coords);
      },
      (err) => {
        console.warn("GPS Lock Failed:", err.message);
        reject(new Error("Signal Lost: Unable to acquire location."));
      },
      { 
        enableHighAccuracy: true, 
        timeout: 15000, 
        maximumAge: 60000 // Accept anything from the last minute if we are desperate
      }
    );
  });
}

export function stopLocationWatch(watchId: number): void {
  if (watchId !== -1) navigator.geolocation.clearWatch(watchId);
}