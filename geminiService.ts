
import { GoogleGenAI, Type } from "@google/genai";
import { DetectionResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function detectPlatesFromImage(base64Image: string): Promise<string[]> {
  if (!base64Image || base64Image.length < 50) return [];
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image
              }
            },
            {
              text: "LAPI (ALPR) MODE: Identifie TOUTES les plaques d'immatriculation françaises (format SIV AA-123-AA ou FNI 1234 AB 75). Retourne uniquement les numéros nettoyés sans espaces ni tirets. Si aucune plaque, retourne []."
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            plates: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["plates"]
        },
        thinkingConfig: { thinkingBudget: 0 } // On veut de la vitesse
      }
    });

    const resultText = response.text;
    if (!resultText) return [];
    
    const result: DetectionResult = JSON.parse(resultText.trim());
    return Array.isArray(result.plates) ? result.plates : [];
  } catch (error) {
    // Silently fail for the user but log for dev
    console.error("LAPI Core Error:", error);
    return [];
  }
}
