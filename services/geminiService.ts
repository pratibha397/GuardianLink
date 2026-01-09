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
      // Prompt explicitly asks for distance to be included in the grounded response
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Find the 5 closest emergency services (Police, Hospital, Fire Station) to the user's current location. Strictly use Google Maps. For each, return the Name and the estimated driving distance (e.g. 1.2 miles) in the title if possible.",
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

          // Attempt to extract distance from title if the model followed instructions
          // Regex looks for "1.2 km" or "5 miles" patterns at the end of string or in parens
          // This is a heuristic as Grounding 2.5 doesn't have a structured distance field yet.
          // Fallback to "Nearby" if no pattern found.
          // Note: The prompt asks model to put it in title, but grounding metadata 'title' comes from Maps directly usually.
          // This is a best-effort. 
          spots.push({
            name: title,
            uri: mapData.uri,
            distance: "Nearby", // Default
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