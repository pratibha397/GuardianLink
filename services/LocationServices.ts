import { GuardianCoords } from '../types';

/**
 * High-performance Location Service for Aegis Mesh.
 * Optimized for emergency tracking with high accuracy.
 */

export type LocationSuccessCallback = (coords: GuardianCoords) => void;
export type LocationErrorCallback = (message: string) => void;

/**
 * Starts watching the user's location with high accuracy.
 */
export function startLocationWatch(
  onUpdate: LocationSuccessCallback,
  onError: LocationErrorCallback
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
          msg = "Permission Denied: Please enable location access.";
          break;
        case error.POSITION_UNAVAILABLE:
          msg = "Signal Lost: GPS position unavailable.";
          break;
        case error.TIMEOUT:
          msg = "GPS Timeout: Location request timed out.";
          break;
      }
      onError(msg);
    },
    options
  );

  return watchId;
}

/**
 * Stops an active location watch.
 */
export function stopLocationWatch(watchId: number): void {
  if (watchId !== -1) {
    navigator.geolocation.clearWatch(watchId);
  }
}