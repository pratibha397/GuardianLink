import { GoogleGenAI } from "@google/genai";
import { SafeSpot } from '../types';

export const GeminiService = {
  getNearbySafeSpots: async (lat: number, lng: number): Promise<SafeSpot[]> => {
    // Generate a direct map search URL as a fallback
    const fallbackSpot: SafeSpot = {
      name: "Search Nearby Emergency Services",
      uri: `https://www.google.com/maps/search/police+hospital+fire+station/@${lat},${lng},14z`,
      distance: "Tap to Search",
      category: "Emergency"
    };

    if (!process.env.API_KEY) {
      console.warn("Gemini API Key missing");
      return [fallbackSpot];
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Find the 5 nearest emergency services (Police Station, Hospital, Fire Station) to this location. List them clearly.",
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
            distance: "Nearby", // Grounding metadata doesn't include calculated distance
            category: category
          });
        }
      }

      // If AI returns nothing, provide the manual fallback so user isn't stranded
      if (spots.length === 0) {
        return [fallbackSpot];
      }

      return spots.slice(0, 5);

    } catch (e) {
      console.error("Gemini Maps Grounding Error:", e);
      // Return fallback on error so functionality remains
      return [fallbackSpot];
    }
  }
};