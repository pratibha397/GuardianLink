
import { GuardianCoords } from '../types';

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

export function stopLocationWatch(watchId: number): void {
  if (watchId !== -1) {
    navigator.geolocation.clearWatch(watchId);
  }
}
