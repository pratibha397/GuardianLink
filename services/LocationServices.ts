
import { GuardianCoords } from '../types';

/**
 * Initiates a high-precision location watch.
 * Enforces PRIORITY_HIGH_ACCURACY equivalents by disabling caching and 
 * setting aggressive hardware timeouts.
 */
export function startLocationWatch(
  onUpdate: (coords: GuardianCoords) => void,
  onError: (message: string) => void
): number {
  if (!navigator.geolocation) {
    onError("Hardware Error: GPS is not supported by this device.");
    return -1;
  }

  // FORCE FRESH COORDINATES: maximumAge: 0 ensures we do not use a cached position
  // enableHighAccuracy: true hints the device to use GPS satellites over network/WiFi trianglulation
  const options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10000, 
    maximumAge: 0 
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
          msg = "Location Access Denied. Check System Permissions.";
          break;
        case error.POSITION_UNAVAILABLE:
          msg = "Satellite Signal Lost. Searching...";
          break;
        case error.TIMEOUT:
          msg = "GPS Acquisition Timeout. Precision restricted.";
          break;
      }
      onError(msg);
    },
    options
  );

  return watchId;
}

/**
 * Single-shot high-accuracy position fetch.
 * Used during emergency triggers to lock the most precise coordinate available.
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
