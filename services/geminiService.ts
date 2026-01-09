import { GoogleGenAI } from "@google/genai";
import { SafeSpot } from '../types';

export const GeminiService = {
  getNearbySafeSpots: async (lat: number, lng: number): Promise<SafeSpot[]> => {
    if (!process.env.API_KEY) {
      console.warn("Gemini API Key missing");
      return [];
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Optimized prompt to get better grounding results
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Find the 5 closest emergency services (Police, Hospital, Fire Station) to the user's current location. For each, strictly use Google Maps to verify they are real physical locations. Prefer locations with a known street address.",
        config: {
          tools: [{googleMaps: {}}],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng
              }
            }
          }
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const spots: SafeSpot[] = [];
      const seenUris = new Set<string>();

      for (const chunk of chunks) {
        // Safe access to maps property with type checking
        const mapData = (chunk as any).maps;
        if (mapData?.title && mapData?.uri) {
          if (seenUris.has(mapData.uri)) continue;
          seenUris.add(mapData.uri);

          const title = mapData.title;
          const lowerTitle = title.toLowerCase();
          let category = "Emergency";
          
          if (lowerTitle.includes("police") || lowerTitle.includes("sheriff") || lowerTitle.includes("constabulary")) category = "Police";
          else if (lowerTitle.includes("hospital") || lowerTitle.includes("medical") || lowerTitle.includes("clinic") || lowerTitle.includes("health") || lowerTitle.includes("infirmary")) category = "Hospital";
          else if (lowerTitle.includes("fire") || lowerTitle.includes("rescue")) category = "Fire Department";

          spots.push({
            name: title,
            uri: mapData.uri,
            // Gemini Grounding 2.5 doesn't explicitly return numeric distance in metadata yet.
            // "Nearby" is the most honest display without doing manual Haversine calc on URI params.
            distance: "Nearby", 
            category: category
          });
        }
      }

      return spots.slice(0, 5);

    } catch (e) {
      console.error("Gemini Maps Grounding Error:", e);
      return [];
    }
  }
};