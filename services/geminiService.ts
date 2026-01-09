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
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "List the 5 nearest real-world emergency services (Police, Hospital, Fire) to the provided location. Use Google Maps to verify they exist. If none found, return nothing.",
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
          
          if (lowerTitle.includes("police") || lowerTitle.includes("sheriff")) category = "Police";
          else if (lowerTitle.includes("hospital") || lowerTitle.includes("medical") || lowerTitle.includes("clinic") || lowerTitle.includes("health")) category = "Hospital";
          else if (lowerTitle.includes("fire")) category = "Fire Department";

          spots.push({
            name: title,
            uri: mapData.uri,
            distance: "Nearby", // Gemini 2.5 grounding often lacks precise distance output
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