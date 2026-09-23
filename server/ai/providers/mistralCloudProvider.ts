import { AIRequestOptions } from "../types";

export interface MistralCloudConfig {
  apiKey: string;
  model: string;
  endpoint: string;
}

export function getMistralConfig(): MistralCloudConfig {
  return {
    apiKey: process.env.MISTRAL_API_KEY || "",
    model: process.env.MISTRAL_CLOUD_MODEL || "mistral-small-latest",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
  };
}

export async function callMistralCloud(
  prompt: string,
  options: AIRequestOptions = {}
): Promise<{ text: string; model: string }> {
  const config = getMistralConfig();

  if (!config.apiKey) {
    throw new Error("Clé MISTRAL_API_KEY manquante sur le serveur Cloud de secours.");
  }

  const systemInstruction = options.systemPrompt 
    ? options.systemPrompt 
    : `Tu es le modèle d'IA souverain Mistral AI hébergé en France pour ALPHABETTE (${options.appContext || 'Général'}).
Tu respectes scrupuleusement la souveraineté européenne des données et le RGPD. Fournis des réponses de haute qualité, sobres et professionnelles en français.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 15000); // 15s max pour le cloud

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1500,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur API Mistral Cloud (HTTP ${response.status}): ${errorText}`);
    }

    const data = await response.json() as any;
    const text = data.choices?.[0]?.message?.content || "Réponse Mistral vide.";

    return {
      text,
      model: `${config.model} (Mistral AI Cloud France)`,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Délai d'attente dépassé avec l'API Mistral AI Cloud France.");
    }
    throw err;
  }
}
