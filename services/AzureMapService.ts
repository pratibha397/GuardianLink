
import { SafeSpot } from '../types';

/**
 * AzureMapsService: Handles nearby emergency service discovery.
 * Uses mathematical logic to calculate unique distances based on current coordinates.
 */
export const AzureMapsService = {
  getNearbyServices: async (lat: number, lng: number): Promise<SafeSpot[]> => {
    // In a real app, this would be an API call. 
    // Here we calculate distinct, deterministic distances for three key categories.
    
    // Simple mock calculation logic to ensure variation and distinct values
    const getDist = (offset: number) => {
      const base = 0.5 + (Math.abs(lat % 1) * 2) + (Math.abs(lng % 1) * 3);
      return (base + offset).toFixed(1);
    };

    const services: SafeSpot[] = [
      {
        name: "District Police Headquarters",
        category: "Police",
        distance: `${getDist(0.2)} km`,
        uri: `https://www.google.com/maps/search/police+station/@${lat},${lng},15z`
      },
      {
        name: "City Medical Center",
        category: "Hospital",
        distance: `${getDist(1.4)} km`,
        uri: `https://www.google.com/maps/search/hospital/@${lat},${lng},15z`
      },
      {
        name: "Central Fire Station",
        category: "Fire Department",
        distance: `${getDist(0.8)} km`,
        uri: `https://www.google.com/maps/search/fire+station/@${lat},${lng},15z`
      }
    ];

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return services;
  }
};
