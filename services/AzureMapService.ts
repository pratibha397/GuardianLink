
import { SafeSpot } from '../types';

/**
 * AzureMapsService (Powered by OpenStreetMap/Overpass API)
 * Fetches REAL emergency infrastructure names and locations.
 */

// Helper: Calculate distance in km
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export const AzureMapsService = {
  getNearbyServices: async (lat: number, lng: number): Promise<SafeSpot[]> => {
    
    // Fetch data from Overpass API
    const fetchOverpass = async (radius: number) => {
      const query = `
        [out:json][timeout:10];
        (
          node["amenity"~"police|hospital|fire_station"](around:${radius},${lat},${lng});
          way["amenity"~"police|hospital|fire_station"](around:${radius},${lat},${lng});
          relation["amenity"~"police|hospital|fire_station"](around:${radius},${lat},${lng});
        );
        out center;
      `;
      
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 8000);
        const response = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: query,
          signal: controller.signal
        });
        clearTimeout(id);
        
        if (!response.ok) return [];
        const data = await response.json();
        return data.elements || [];
      } catch (e) {
        console.warn(`Overpass fetch failed for radius ${radius}`, e);
        return [];
      }
    };

    // Process raw OSM elements into SafeSpot objects
    const processElements = (elements: any[]): (SafeSpot & { numericDist: number })[] => {
      return elements.map((el: any) => {
        const elLat = el.lat || el.center?.lat;
        const elLng = el.lon || el.center?.lon;
        if (!elLat || !elLng) return null;

        const dist = getDistanceFromLatLonInKm(lat, lng, elLat, elLng);
        const amenity = el.tags.amenity;
        
        let category = "Emergency";
        if (amenity === 'police') category = "Police";
        else if (amenity === 'hospital') category = "Hospital";
        else if (amenity === 'fire_station') category = "Fire Department";

        let name = el.tags.name;
        // If no name, try operator or generate descriptive fallback
        if (!name) {
           if (el.tags.operator) name = `${category} (${el.tags.operator})`;
           else name = `Nearest ${category}`;
        }

        return {
          name: name,
          category: category,
          distance: `${dist.toFixed(2)} km`,
          numericDist: dist,
          uri: `https://www.google.com/maps/search/?api=1&query=${elLat},${elLng}`
        };
      }).filter(Boolean) as (SafeSpot & { numericDist: number })[];
    };

    // Strategy: Start small (2km) to prioritize immediate vicinity.
    // If we don't find all services, expand to 10km, then 30km.
    
    let allSpots: (SafeSpot & { numericDist: number })[] = [];
    const radii = [2000, 10000, 30000];

    for (const r of radii) {
      const elements = await fetchOverpass(r);
      const spots = processElements(elements);
      
      // CRITICAL FIX: Sort raw spots by distance ASCENDING immediately.
      // This ensures that if there are duplicates (e.g., "City Hospital" at 1km and 5km),
      // we encounter the 1km one first and keep it during the merge step below.
      spots.sort((a, b) => a.numericDist - b.numericDist);

      // Merge into allSpots (deduplication logic)
      spots.forEach(s => {
        // Only add if we don't already have a spot with this name+category
        if (!allSpots.some(existing => existing.name === s.name && existing.category === s.category)) {
          allSpots.push(s);
        }
      });

      // Check if we have at least one of each category found so far
      const hasPolice = allSpots.some(s => s.category === 'Police');
      const hasHospital = allSpots.some(s => s.category === 'Hospital');
      const hasFire = allSpots.some(s => s.category === 'Fire Department');

      // If we have all three, we can stop searching wider radii
      if (hasPolice && hasHospital && hasFire) break; 
    }

    // Final Sort by distance to ensure the absolute nearest appear first in the generic list
    allSpots.sort((a, b) => a.numericDist - b.numericDist);

    // Extract the absolute nearest of each category to prioritize display
    const nearestPolice = allSpots.find(s => s.category === 'Police');
    const nearestHospital = allSpots.find(s => s.category === 'Hospital');
    const nearestFire = allSpots.find(s => s.category === 'Fire Department');

    const result: SafeSpot[] = [];
    if (nearestPolice) result.push(nearestPolice);
    if (nearestHospital) result.push(nearestHospital);
    if (nearestFire) result.push(nearestFire);

    return result;
  }
};
