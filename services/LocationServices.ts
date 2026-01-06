
import { GuardianCoords } from '../types';

/**
 * Standard Geolocation Options configured for "High Accuracy" (GPS Priority).
 * Emulates Android's PRIORITY_HIGH_ACCURACY.
 */
const HIGH_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,   // Increased to 15s for cold starts/indoor fixes
  maximumAge: 0     // Force fresh satellite data, zero caching
};

/**
 * Initiates a persistent, high-frequency location watch.
 * Updates every time the hardware detects a shift in coordinates.
 */
export function startLocationWatch(
  onUpdate: (coords: GuardianCoords) => void,
  onError: (message: string) => void
): number {
  if (!navigator.geolocation) {
    onError("Hardware Incompatibility: GPS missing.");
    return -1;
  }

  const watchId = navigator.geolocation.watchPosition(
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
      switch (error.code) {
        case error.PERMISSION_DENIED:
          msg = "Access Denied: Grant GPS permissions in settings.";
          break;
        case error.POSITION_UNAVAILABLE:
          msg = "Satellite Fix Unavailable: Move to an open area.";
          break;
        case error.TIMEOUT:
          msg = "GPS Signal Timed Out: Searching for satellites...";
          break;
      }
      onError(msg);
    },
    HIGH_ACCURACY_OPTIONS
  );

  return watchId;
}

/**
 * Performs a forced, high-priority location capture with retries.
 * Guaranteed to attempt high-accuracy locking before resolving.
 */
export async function getPreciseCurrentPosition(retryCount = 2): Promise<GuardianCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("No GPS Hardware"));
      return;
    }

    const attemptFetch = (remainingRetries: number) => {
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
          if (remainingRetries > 0) {
            console.warn(`GPS fix failed, retrying... (${remainingRetries} left)`);
            attemptFetch(remainingRetries - 1);
          } else {
            reject(err);
          }
        },
        HIGH_ACCURACY_OPTIONS
      );
    };

    attemptFetch(retryCount);
  });
}

export function stopLocationWatch(watchId: number): void {
  if (watchId !== -1) {
    navigator.geolocation.clearWatch(watchId);
  }
}
