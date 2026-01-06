
import { GuardianCoords } from '../types';

/**
 * Strategy: Fast-Path Priority.
 * We prioritize speed (cached) over precision (fresh) for the first 3 seconds of an emergency.
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

  return navigator.geolocation.watchPosition(
    (position) => {
      const c = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      };
      lastCapturedCoords = c;
      onUpdate(c);
    },
    (error) => {
      console.warn("Watch stream signal dip:", error.message);
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}

/**
 * Robust SOS Coordinate Resolver.
 * 1. Immediate memory check.
 * 2. Rapid browser cache check (< 1s).
 * 3. Racing fresh lock (3s timeout).
 */
export async function getPreciseCurrentPosition(): Promise<GuardianCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("No GPS"));
      return;
    }

    let isResolved = false;

    const fastFinish = (coords: GuardianCoords, source: string) => {
      if (isResolved) return;
      if (coords.lat === 0 && coords.lng === 0) return;
      isResolved = true;
      console.log(`SOS Location sourced from: ${source}`);
      resolve(coords);
    };

    // PRIORITY 1: Memory Cache (Immediate)
    if (lastCapturedCoords) {
      fastFinish(lastCapturedCoords, "Memory Cache");
    }

    // PRIORITY 2: Browser Cached Position (Fast < 1s)
    navigator.geolocation.getCurrentPosition(
      (pos) => fastFinish({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp
      }, "Browser Cache"),
      null,
      { enableHighAccuracy: false, timeout: 1000, maximumAge: 600000 }
    );

    // PRIORITY 3: Racing Fresh Lock (Tight 3s limit)
    navigator.geolocation.getCurrentPosition(
      (pos) => fastFinish({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp
      }, "Fresh High-Accuracy Lock"),
      (err) => {
        if (!isResolved) {
          // If fresh lock fails and we still haven't resolved anything, 
          // use the absolute best available or fallback to a default if truly desperate.
          if (lastCapturedCoords) fastFinish(lastCapturedCoords, "Emergency Fallback");
          else reject(new Error("Signal Lost"));
        }
      },
      { enableHighAccuracy: true, timeout: 3000, maximumAge: 0 }
    );

    // Safety net: If after 3.5s nothing has resolved, force the memory cache or throw.
    setTimeout(() => {
      if (!isResolved) {
        if (lastCapturedCoords) fastFinish(lastCapturedCoords, "Timeout Force Fallback");
        else reject(new Error("GPS Dead"));
      }
    }, 3500);
  });
}

export function stopLocationWatch(watchId: number): void {
  if (watchId !== -1) navigator.geolocation.clearWatch(watchId);
}
