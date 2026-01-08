import { SafeSpot } from '../types';

/**
 * AzureMapsService: Handles nearby emergency service discovery.
 * Uses mathematical logic to calculate unique distances based on current coordinates.
 */
export const AzureMapsService = {
  getNearbyServices: async (lat: number, lng: number): Promise<SafeSpot[]> => {
    // 1. Expanded Data Pool (Mock Database)
    const servicePool = [
      { name: "Central District Police", category: "Police", seed: 142, query: "police+station" },
      { name: "St. Mary's Medical Center", category: "Hospital", seed: 931, query: "hospital" },
      { name: "Metro Fire & Rescue", category: "Fire Department", seed: 528, query: "fire+station" },
      { name: "City General Hospital", category: "Hospital", seed: 334, query: "hospital" },
      { name: "Harbor Patrol Station", category: "Police", seed: 712, query: "police+station" },
      { name: "Northside Emergency Unit", category: "Hospital", seed: 111, query: "hospital" },
      { name: "West End Fire Brigade", category: "Fire Department", seed: 665, query: "fire+station" },
      { name: "Transit Authority Police", category: "Police", seed: 899, query: "police+station" }
    ];

    // 2. Calculate Distance & Sort
    // We use a deterministic formula so the distance remains stable for a specific location
    // but changes realistically as the user moves (lat/lng changes).
    const calculatedServices = servicePool.map(service => {
      // Create a variation based on high-precision coordinates and service ID
      const locationFactor = Math.abs((lat * 1000) + (lng * 1000));
      const variation = (locationFactor + service.seed) % 100;
      
      // Map to a realistic range: 0.2km to 10.2km
      const distanceKm = 0.2 + (variation / 10);

      return {
        ...service,
        numericDistance: distanceKm,
        formattedDistance: `${distanceKm.toFixed(2)} km`
      };
    });

    // 3. Sort ascending (Nearest first)
    calculatedServices.sort((a, b) => a.numericDistance - b.numericDistance);

    // 4. Return Top 3
    const topServices: SafeSpot[] = calculatedServices.slice(0, 3).map(s => ({
      name: s.name,
      category: s.category,
      distance: s.formattedDistance,
      uri: `https://www.google.com/maps/search/${s.query}/@${lat},${lng},15z`
    }));

    // Simulate network latency for realism
    await new Promise(resolve => setTimeout(resolve, 400));
    
    return topServices;
  }
};