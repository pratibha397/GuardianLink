
import { GuardianCoords } from '../types';

/**
 * Stage 1: Fast Cache Retrieval (resolve in < 1s)
 */
const CACHE_FETCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 1000,
  maximumAge: 300000 // 5 mins cache
};

/**
 * Stage 2: Satellite Lock (resolve in < 4s)
 */
const SATELLITE_LOCK_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 4000,
  maximumAge: 0
};

/**
 * Shared coordinates for instant fallback
 */
let lastCapturedCoords: GuardianCoords | null = null;

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
      onError("Satellite Signal Weak");
    },
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
}

/**
 * Robust SOS Coordinate Resolver.
 * Guaranteed resolution with best-available data or failure after 5 seconds.
 */
export async function getPreciseCurrentPosition(): Promise<GuardianCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("No GPS Hardware"));
      return;
    }

    let isDone = false;

    const finalize = (coords: GuardianCoords, source: string) => {
      if (isDone) return;
      isDone = true;
      console.log(`SOS Location sourced from: ${source}`);
      resolve(coords);
    };

    // 1. Check last captured (Instant)
    if (lastCapturedCoords) {
      finalize(lastCapturedCoords, "Watch Stream Cache");
    }

    // 2. Try Browser Cache (Fallback)
    navigator.geolocation.getCurrentPosition(
      (pos) => finalize({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp
      }, "Browser Cache"),
      () => console.warn("Cache fetch failed"),
      CACHE_FETCH_OPTIONS
    );

    // 3. Try Fresh Satellite Lock (Precision)
    navigator.geolocation.getCurrentPosition(
      (pos) => finalize({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp
      }, "Fresh Satellite Fix"),
      (err) => {
        if (!isDone) {
          if (lastCapturedCoords) {
            finalize(lastCapturedCoords, "Critical Fallback to Last Known");
          } else {
            reject(new Error("Unable to establish GPS link."));
          }
        }
      },
      SATELLITE_LOCK_OPTIONS
    );

    // 4. Force Timeout Safety
    setTimeout(() => {
      if (!isDone) {
        if (lastCapturedCoords) {
          finalize(lastCapturedCoords, "Watch Stream Timeout Fallback");
        } else {
          reject(new Error("GPS Link Timeout."));
        }
      }
    }, 5500);
  });
}

export function stopLocationWatch(watchId: number): void {
  if (watchId !== -1) navigator.geolocation.clearWatch(watchId);
}
