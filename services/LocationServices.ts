/**
 * High-performance Location Service for GuardianVoice.
 * Optimized for emergency tracking with high accuracy.
 */

export interface Coordinates {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

export type LocationSuccessCallback = (coords: Coordinates) => void;
export type LocationErrorCallback = (message: string) => void;

/**
 * Starts watching the user's location with high accuracy.
 * @param onUpdate - Callback triggered on location change.
 * @param onError - Callback triggered on GPS failure.
 * @returns watchId - ID for clearing the watch.
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
          msg = "Signal Lost: GPS position is currently unavailable.";
          break;
        case error.TIMEOUT:
          msg = "GPS Timeout: Request for location timed out.";
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
 * @param watchId - The ID returned by startLocationWatch.
 */
export function stopLocationWatch(watchId: number): void {
  if (watchId !== -1) {
    navigator.geolocation.clearWatch(watchId);
  }
}