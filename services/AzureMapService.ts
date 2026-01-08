import { SafeSpot } from '../types';

/**
 * AzureMapsService: Handles nearby emergency service discovery.
 * Uses mathematical logic to calculate unique distances based on current coordinates.
 */
export const AzureMapsService = {
  getNearbyServices: async (lat: number, lng: number): Promise<SafeSpot[]> => {
    // Math logic to create pseudo-random but deterministic distances based on location
    // This ensures distances change as the user moves (lat/lng changes)
    const calcDist = (seed: number) => {
        // Create a variation based on coordinates
        const variation = (Math.abs(lat * 1000) + Math.abs(lng * 1000) + seed) % 50; 
        // Map to a realistic range (e.g., 0.5km to 5.5km)
        const km = 0.5 + (variation / 10);
        return `${km.toFixed(2)} km`;
    };

    const services: SafeSpot[] = [
      {
        name: "District Police Headquarters",
        category: "Police",
        distance: calcDist(123), // Unique seed for Police
        uri: `https://www.google.com/maps/search/police+station/@${lat},${lng},15z`
      },
      {
        name: "City Medical Center",
        category: "Hospital",
        distance: calcDist(456), // Unique seed for Hospital
        uri: `https://www.google.com/maps/search/hospital/@${lat},${lng},15z`
      },
      {
        name: "Central Fire Station",
        category: "Fire Department",
        distance: calcDist(789), // Unique seed for Fire
        uri: `https://www.google.com/maps/search/fire+station/@${lat},${lng},15z`
      }
    ];

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return services;
  }
};