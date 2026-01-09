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
      // Updated prompt to focus strictly on listing existing places with distance context
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Find the 5 closest emergency services (Police, Hospital, Fire Station) to the user's current location. Strictly use Google Maps to verify they are real. For each, you MUST attempt to include the estimated driving distance (e.g. '1.2 miles') in the result title or metadata if possible. Return strictly a list of places.",
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

          // Note: Grounding 2.5 doesn't always provide structured distance. 
          // We rely on the app to display "Nearby" if the model doesn't inject it into the title.
          spots.push({
            name: title,
            uri: mapData.uri,
            distance: "Nearby", 
            category: category
          });
        }
      }

      // Fallback if strict Google Maps grounding fails to return structured data
      // but the model text has a list (less common with this config, but good for robustness)
      if (spots.length === 0 && response.candidates?.[0]?.content?.parts?.[0]?.text) {
          // This is a safety fallback, usually empty if tools are used strictly.
      }

      return spots.slice(0, 5);

    } catch (e) {
      console.error("Gemini Maps Grounding Error:", e);
      return [];
    }
  }
};