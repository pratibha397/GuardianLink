
import { SafeSpot } from '../types';

/**
 * AzureMapsService (Official Microsoft Azure Maps Implementation)
 * Requires AZURE_MAPS_KEY in .env file
 */

const SUBSCRIPTION_KEY = process.env.AZURE_MAPS_KEY;

export const AzureMapsService = {
  getNearbyServices: async (lat: number, lng: number): Promise<SafeSpot[]> => {
    if (!SUBSCRIPTION_KEY) {
      console.error("Azure Maps Key missing. Check .env file.");
      return [];
    }

    // Azure Maps Category IDs:
    // 9219: Police Station
    // 8060: Hospital
    // 9220: Fire Station
    const categorySet = "9219,8060,9220";
    
    // Search Radius in meters (Start with 5km)
    const radius = 5000;

    const url = `https://atlas.microsoft.com/search/poi/category/json?api-version=1.0&query=EMERGENCY&lat=${lat}&lon=${lng}&radius=${radius}&categorySet=${categorySet}&subscription-key=${SUBSCRIPTION_KEY}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Azure API Error");
      
      const data = await response.json();
      const results = data.results || [];

      // Map Azure POI format to App format
      const spots: SafeSpot[] = results.map((poi: any) => {
        const distKm = poi.dist / 1000;
        const categoryId = poi.poi?.categorySet?.[0]?.id;
        
        let category = "Emergency";
        if (categoryId === 9219) category = "Police";
        else if (categoryId === 8060) category = "Hospital";
        else if (categoryId === 9220) category = "Fire Department";
        // Fallback based on name if category ID is ambiguous
        else {
           const n = (poi.poi.name || "").toLowerCase();
           if (n.includes("police")) category = "Police";
           else if (n.includes("fire")) category = "Fire Department";
           else if (n.includes("hospital") || n.includes("medical")) category = "Hospital";
        }

        return {
          name: poi.poi.name || "Emergency Service",
          category: category,
          distance: `${distKm.toFixed(2)} km`,
          // Azure returns exact location of the POI
          uri: `https://www.google.com/maps/search/?api=1&query=${poi.position.lat},${poi.position.lon}`,
          numericDist: distKm
        };
      });

      // Sort by distance
      spots.sort((a: any, b: any) => a.numericDist - b.numericDist);

      // Prioritize logic: Get nearest of each type
      const nearestPolice = spots.find(s => s.category === 'Police');
      const nearestHospital = spots.find(s => s.category === 'Hospital');
      const nearestFire = spots.find(s => s.category === 'Fire Department');

      const finalResults: SafeSpot[] = [];
      if (nearestPolice) finalResults.push(nearestPolice);
      if (nearestHospital) finalResults.push(nearestHospital);
      if (nearestFire) finalResults.push(nearestFire);
      
      return finalResults;

    } catch (e) {
      console.error("Azure Maps fetch failed", e);
      return [];
    }
  }
};
