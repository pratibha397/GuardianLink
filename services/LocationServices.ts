
import { GuardianCoords } from '../types';

/**
 * Priority 1: High Accuracy GPS (Satellite Lock)
 */
const HIGH_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,   // 10s for fresh lock
  maximumAge: 0     // No caching
};

/**
 * Priority 2: Balanced/Cached Fallback
 */
const BALANCED_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 5000,
  maximumAge: 30000 // 30s cache
};

/**
 * Initiates a persistent watch for the UI telemetry.
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
 * Robust SOS Coordinate Acquisition Chain.
 * Ensures a valid fix is obtained before proceeding.
 */
export async function getPreciseCurrentPosition(): Promise<GuardianCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("No GPS Hardware"));
      return;
    }

    // Stage 1: Try High Accuracy (GPS Lock)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (pos.coords.latitude && pos.coords.longitude) {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
            timestamp: pos.timestamp
          });
        } else {
          reject(new Error("Invalid coordinates received."));
        }
      },
      (err) => {
        console.warn("GPS lock failed, trying balanced fallback...", err.message);
        
        // Stage 2: Balanced/Cached Fallback
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => {
            resolve({
              lat: fallbackPos.coords.latitude,
              lng: fallbackPos.coords.longitude,
              accuracy: fallbackPos.coords.accuracy,
              timestamp: fallbackPos.timestamp
            });
          },
          () => reject(new Error("GPS signal timeout: Unable to establish emergency lock.")),
          BALANCED_OPTIONS
        );
      },
      HIGH_ACCURACY_OPTIONS
    );
  });
}

export function stopLocationWatch(watchId: number): void {
  if (watchId !== -1) {
    navigator.geolocation.clearWatch(watchId);
  }
}
