import { AIRequestOptions } from "../types";

export interface LocalAIConfig {
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

export function getLocalConfig(): LocalAIConfig {
  return {
    baseUrl: process.env.LOCAL_AI_URL || "http://localhost:11434",
    model: process.env.LOCAL_AI_MODEL || "mistral-nemo",
    timeoutMs: parseInt(process.env.LOCAL_AI_TIMEOUT_MS || "3500", 10),
  };
}

export async function callLocalAI(
  prompt: string,
  options: AIRequestOptions = {}
): Promise<{ text: string; model: string }> {
  const config = getLocalConfig();
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;

  // Simulation volontaire de panne pour tester la résilience et le fallback
  if (options.simulateLocalFailure) {
    throw new Error(`[SIMULATION_PANNE] Le serveur local haute performance a simulé un timeout (${timeoutMs}ms) ou une panne de courant.`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const systemInstruction = options.systemPrompt 
    ? options.systemPrompt 
    : `Tu es le modèle d'IA local souverain de la suite ALPHABETTE (${options.appContext || 'Général'}).
Tu t'exécutes sur une machine dédiée haute performance en circuit fermé. Zéro donnée ne quitte cette machine. Réponds avec précision, clarté et concision en français.`;

  try {
    const endpoint = `${config.baseUrl.replace(/\/$/, '')}/api/chat`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ],
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
        }
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Serveur local a retourné un statut d'erreur HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as any;
    const text = data?.message?.content || data?.response || "Réponse locale vide.";

    return {
      text,
      model: `${config.model} (Local Dedicated Rig)`,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error(`Dépassement du délai d'attente (${timeoutMs}ms) sur le serveur local.`);
    }
    throw err;
  }
}
