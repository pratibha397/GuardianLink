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

  // Using standard high accuracy options
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
      lastCapturedCoords = c;
      onUpdate(c);
    },
    (error) => {
      console.warn("Watch stream signal dip:", error.message);
      // Do not hard fail on temporary signal loss during watch
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
  );
}

/**
 * Robust SOS Coordinate Resolver.
 * Fixes "Signal Lost" bug by using standard timeouts and fallback logic.
 */
export async function getPreciseCurrentPosition(): Promise<GuardianCoords> {
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
        
        // Fallback: If fresh lock fails, use the last known watched position
        if (lastCapturedCoords) {
          console.log("SOS Location: Using Cached Fallback");
          resolve(lastCapturedCoords);
        } else {
          // Absolute failure scenario
          reject(new Error("Signal Lost: Unable to acquire location."));
        }
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, // 10s gives GPS enough time to warm up
        maximumAge: 10000 // Accept positions up to 10s old for speed
      }
    );
  });
}

export function stopLocationWatch(watchId: number): void {
  if (watchId !== -1) navigator.geolocation.clearWatch(watchId);
}