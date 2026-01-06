
import { GuardianCoords } from '../types';

/**
 * SOS_PRIORITY_OPTIONS: Extremely aggressive timeouts for emergency dispatch.
 */
const SOS_FAST_CACHE: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 1500,      // 1.5s limit for cached data
  maximumAge: 600000  // 10 minutes cache acceptable for emergency start
};

const SOS_HIGH_ACCURACY: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 5000,      // 5s limit for fresh satellite lock
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
 * Immediate SOS Coordinate Acquisition.
 * Priority 1: Instant Cached Location (resolve in < 1.5s).
 * Priority 2: Fresh satellite lock (resolve in < 5s).
 * Guaranteed to return coordinates if ANY source is available.
 */
export async function getPreciseCurrentPosition(): Promise<GuardianCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("No GPS Hardware Detected"));
      return;
    }

    let resolved = false;

    // Fast-path: Try cached location immediately
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!resolved) {
          resolved = true;
          console.log("SOS: Using cached coordinates for speed.");
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp
          });
        }
      },
      () => console.warn("SOS: No cached coordinates found."),
      SOS_FAST_CACHE
    );

    // Precision-path: Request fresh lock in parallel
    setTimeout(() => {
      if (!resolved) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!resolved) {
              resolved = true;
              console.log("SOS: High-accuracy satellite lock achieved.");
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
            if (!resolved) {
              resolved = true;
              reject(new Error("SOS ERROR: Satellite link failed. Check your environment."));
            }
          },
          SOS_HIGH_ACCURACY
        );
      }
    }, 100); 
  });
}

export function stopLocationWatch(watchId: number): void {
  if (watchId !== -1) {
    navigator.geolocation.clearWatch(watchId);
  }
}
