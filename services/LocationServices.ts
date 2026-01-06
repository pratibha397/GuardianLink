
import { GuardianCoords } from '../types';

/**
 * Standard Geolocation Options.
 * emulates PRIORITY_HIGH_ACCURACY for fresh satellite data.
 */
const HIGH_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,   // Strict 10s window for SOS dispatch
  maximumAge: 0     // No caching
};

/**
 * Fast Fallback Options.
 * Pulls the last known position from the browser cache immediately.
 */
const CACHED_FALLBACK_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 2000,
  maximumAge: 600000 // 10 minutes cache
};

/**
 * Persistent Watcher for Real-Time UI Updates.
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
 * Robust SOS Coordinate Lock.
 * Priority 1: Attempts fresh high-accuracy GPS fix (10s timeout).
 * Priority 2: Falls back to last known location if GPS fails/times out.
 */
export async function getPreciseCurrentPosition(): Promise<GuardianCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("No GPS Hardware"));
      return;
    }

    // Try High Accuracy first
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed,
        heading: pos.coords.heading,
        timestamp: pos.timestamp
      }),
      (err) => {
        console.warn("High-accuracy fix failed, attempting cached fallback...", err.message);
        // Fallback to cached location
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => resolve({
            lat: fallbackPos.coords.latitude,
            lng: fallbackPos.coords.longitude,
            accuracy: fallbackPos.coords.accuracy,
            timestamp: fallbackPos.timestamp
          }),
          () => reject(new Error("Signal timeout: Unable to establish location lock.")),
          CACHED_FALLBACK_OPTIONS
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
