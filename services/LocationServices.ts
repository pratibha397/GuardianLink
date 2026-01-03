
import { GuardianCoords } from '../types';

export function startLocationWatch(
  onUpdate: (coords: GuardianCoords) => void,
  onError: (message: string) => void
): number {
  if (!navigator.geolocation) {
    onError("Hardware Error: GPS is not supported by this device.");
    return -1;
  }

  // Optimized for resilience: 
  // - timeout increased to 30s to give hardware more time
  // - maximumAge set to 5s to allow for a quick initial fix from cache
  const options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 30000, 
    maximumAge: 5000
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
          msg = "Permission Denied: Please enable location access in settings.";
          break;
        case error.POSITION_UNAVAILABLE:
          msg = "Signal Lost: Trying to re-establish connection...";
          break;
        case error.TIMEOUT:
          msg = "GPS Timeout: Satellite signal is weak. Move near a window or outdoors.";
          break;
      }
      onError(msg);
      
      // If we timeout on High Accuracy, try one-shot low accuracy as a fallback
      if (error.code === error.TIMEOUT) {
        navigator.geolocation.getCurrentPosition(
          (pos) => onUpdate({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp
          }),
          null,
          { enableHighAccuracy: false, timeout: 10000 }
        );
      }
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
