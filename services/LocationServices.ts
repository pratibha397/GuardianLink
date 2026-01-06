
import { GuardianCoords } from '../types';

/**
 * Initiates a high-precision location watch.
 * Enforces PRIORITY_HIGH_ACCURACY by setting enableHighAccuracy to true
 * and disabling caching (maximumAge: 0) to ensure data is fresh from GPS satellites.
 */
export function startLocationWatch(
  onUpdate: (coords: GuardianCoords) => void,
  onError: (message: string) => void
): number {
  if (!navigator.geolocation) {
    onError("GPS Hardware Missing");
    return -1;
  }

  const options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10000, 
    maximumAge: 0 // Prevents using cached network locations
  };

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
          msg = "GPS Permission Denied";
          break;
        case error.POSITION_UNAVAILABLE:
          msg = "Satellite Fix Lost";
          break;
        case error.TIMEOUT:
          msg = "GPS Signal Timeout";
          break;
      }
      onError(msg);
    },
    options
  );

  return watchId;
}

/**
 * Captures a single, high-accuracy coordinate fix immediately.
 * Primarily used for SOS locking.
 */
export async function getPreciseCurrentPosition(): Promise<GuardianCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("No GPS Hardware"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed,
        heading: pos.coords.heading,
        timestamp: pos.timestamp
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });
}

export function stopLocationWatch(watchId: number): void {
  if (watchId !== -1) {
    navigator.geolocation.clearWatch(watchId);
  }
}
