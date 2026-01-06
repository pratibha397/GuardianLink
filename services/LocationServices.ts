
import { GuardianCoords } from '../types';

/**
 * Initiates a high-precision location watch.
 * Uses enableHighAccuracy: true to force GPS satellite usage over network triangulation.
 * Sets maximumAge: 0 to bypass cached location data.
 */
export function startLocationWatch(
  onUpdate: (coords: GuardianCoords) => void,
  onError: (message: string) => void
): number {
  if (!navigator.geolocation) {
    onError("Hardware Error: GPS is not supported by this device.");
    return -1;
  }

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
          msg = "Satellite Signal Lost. Check GPS settings.";
          break;
        case error.TIMEOUT:
          msg = "GPS Acquisition Timeout. Retrying...";
          break;
      }
      onError(msg);
    },
    options
  );

  return watchId;
}

/**
 * Single-shot fresh coordinate capture for emergency events.
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
      { 
        enableHighAccuracy: true, 
        timeout: 5000, 
        maximumAge: 0 
      }
    );
  });
}

export function stopLocationWatch(watchId: number): void {
  if (watchId !== -1) {
    navigator.geolocation.clearWatch(watchId);
  }
}
