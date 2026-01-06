
import { GuardianCoords } from '../types';

/**
 * High-Speed Fallback: Fetches the last known location from cache instantly.
 */
const FAST_FIX_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 3000,
  maximumAge: 300000 // 5 minutes cache
};

/**
 * High-Precision Lock: Forces fresh satellite coordinates.
 */
const PRECISION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0
};

/**
 * Persistent Location Stream for UI Telemetry.
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
      onUpdate({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        heading: position.coords.heading,
        timestamp: position.timestamp
      });
    },
    (error) => {
      let msg = "GPS Signal Error";
      if (error.code === error.PERMISSION_DENIED) msg = "Location Access Denied";
      onError(msg);
    },
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
}

/**
 * Critical SOS Coordinate Fetcher.
 * 1. Instantly tries to grab a cached location (2s timeout).
 * 2. If no cache, waits up to 8s for a fresh precision lock.
 * 3. Guaranteed to resolve with the best available data or fail.
 */
export async function getPreciseCurrentPosition(): Promise<GuardianCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("No GPS Hardware"));
      return;
    }

    let hasResolved = false;

    // Attempt 1: Fast Fix (Cached)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!hasResolved) {
          hasResolved = true;
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp
          });
        }
      },
      () => {
        console.warn("Fast-fix failed, awaiting precision lock...");
      },
      FAST_FIX_OPTIONS
    );

    // Attempt 2: Precision Fix (Fresh) - Runs in parallel, takes precedence if faster or if cache fails
    setTimeout(() => {
      if (!hasResolved) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!hasResolved) {
              hasResolved = true;
              resolve({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                speed: pos.coords.speed,
                heading: pos.coords.heading,
                timestamp: pos.timestamp
              });
            }
          },
          (err) => {
            if (!hasResolved) {
              hasResolved = true;
              reject(new Error("SOS Fail: No GPS signal available. Check satellite visibility."));
            }
          },
          PRECISION_OPTIONS
        );
      }
    }, 100); // Tiny offset to give Fast Fix a chance to hit cache first
  });
}

export function stopLocationWatch(watchId: number): void {
  if (watchId !== -1) {
    navigator.geolocation.clearWatch(watchId);
  }
}
