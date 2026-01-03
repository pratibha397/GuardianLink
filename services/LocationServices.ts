
/**
 * Senior Architect Location Service
 * Optimized for high-frequency emergency tracking.
 */

export interface LocationCoords {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

export type LocationSuccessCallback = (coords: LocationCoords) => void;
export type LocationErrorCallback = (message: string) => void;

/**
 * Starts high-frequency geolocation tracking.
 * @returns watchId to be used for stopping tracking.
 */
export function startLocationTracking(
  onSuccess: LocationSuccessCallback,
  onError: LocationErrorCallback
): number {
  if (!navigator.geolocation) {
    onError("Hardware Error: Your device does not support GPS tracking.");
    return -1;
  }

  const options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0
  };

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      onSuccess({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        heading: position.coords.heading,
        timestamp: position.timestamp
      });
    },
    (error) => {
      let msg = "GPS Error";
      if (error.code === error.PERMISSION_DENIED) msg = "Location permission denied.";
      else if (error.code === error.POSITION_UNAVAILABLE) msg = "GPS signal lost.";
      else if (error.code === error.TIMEOUT) msg = "GPS search timed out.";
      onError(msg);
    },
    options
  );

  return watchId;
}

export function stopLocationTracking(watchId: number) {
  if (watchId !== -1) {
    navigator.geolocation.clearWatch(watchId);
  }
}
