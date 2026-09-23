import { GoogleGenAI } from "@google/genai";
import { AIRequestOptions } from "../types";

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

export async function callGemini(
  prompt: string, 
  options: AIRequestOptions = {}
): Promise<{ text: string; model: string }> {
  const client = getGeminiClient();
  if (!client) {
    throw new Error("Clé GEMINI_API_KEY non configurée dans l'environnement serveur.");
  }

  const modelName = "gemini-3.8-flash";
  const systemInstruction = options.systemPrompt 
    ? options.systemPrompt 
    : `Tu es le moteur d'intelligence artificielle de la suite applicative éthique ALPHABETTE (fondée par Valentin RICHAUD).
Contexte applicatif: ${options.appContext || 'ALPHABETTE Hub'}.
Tes valeurs clés: rigueur scientifique, clarté, absence de jargon inutile, respect strict de la sobriété numérique et du RGPD, neutralité bienveillante. Réponds en français clair et structuré.`;

  const response = await client.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      systemInstruction: systemInstruction,
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 1500,
    },
  });

  const text = response.text || "Aucune réponse générée.";
  return {
    text,
    model: modelName,
  };
}
