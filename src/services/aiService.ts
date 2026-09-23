export type AIProviderId = 
  | 'gemini' 
  | 'hybrid_mistral' 
  | 'local' 
  | 'mistral_cloud';

export type EffectiveProviderUsed = 
  | 'gemini' 
  | 'local_server' 
  | 'mistral_cloud_fallback' 
  | 'mistral_cloud'
  | 'sovereign_rule_engine';

export type SovereigntyLevel = 
  | 'local_strict' 
  | 'european_cloud' 
  | 'development_sandbox';

export interface AIRequestOptions {
  appContext?: string; // ex: 'LIDARSOL', 'OSOLAR', 'PROXILIEN', 'INFOS PERSO', 'ATELIER 3D'
  systemPrompt?: string;
  provider?: AIProviderId;
  temperature?: number;
  maxTokens?: number;
  simulateLocalFailure?: boolean; // Pour tester la résilience et le fallback en direct
  timeoutMs?: number;
}

export interface AITelemetry {
  providerRequested: AIProviderId;
  providerUsed: EffectiveProviderUsed;
  model: string;
  latencyMs: number;
  fallbackTriggered: boolean;
  fallbackReason?: string;
  sovereigntyLevel: SovereigntyLevel;
  sovereigntyBadge: string;
  serverLocation: string;
  carbonEcoRating: string;
  timestamp: string;
}

export interface AIResponsePayload {
  text: string;
  telemetry: AITelemetry;
  appContext?: string;
}

export interface AIConfigResponse {
  activeProvider: AIProviderId;
  availableProviders: {
    id: AIProviderId;
    name: string;
    description: string;
    status: string;
    phase: string;
    localUrl?: string;
    timeoutMs?: number;
    isMistralCloudConfigured?: boolean;
  }[];
  localServerConfig: {
    endpoint: string;
    model: string;
    timeoutMs: number;
  };
  hasGeminiKey: boolean;
  hasMistralKey: boolean;
}

/**
 * Fonction unifiée de requêtage IA pour le code métier ALPHABETTE.
 * Aucune clé API n'est exposée au navigateur : la requête transite par le backend sécurisé.
 * 
 * @param prompt Le texte ou prompt de la requête utilisateur
 * @param options Paramètres contextuels (application cible, provider, simulation de panne...)
 */
export async function askAI(
  prompt: string, 
  options: AIRequestOptions = {}
): Promise<AIResponsePayload> {
  const response = await fetch('/api/ai/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, options }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: 'Erreur réseau inconnue' }));
    throw new Error(errData.error || `Erreur serveur HTTP ${response.status}`);
  }

  const json = await response.json();
  if (!json.success || !json.data) {
    throw new Error(json.error || "Réponse invalide reçue de l'API d'IA.");
  }

  return json.data as AIResponsePayload;
}

/**
 * Récupère l'état de la configuration et des fournisseurs du routeur IA.
 */
export async function getAIConfig(): Promise<AIConfigResponse> {
  const response = await fetch('/api/ai/config');
  if (!response.ok) {
    throw new Error(`Impossible de charger la configuration IA (HTTP ${response.status})`);
  }
  return response.json();
}

/**
 * Met à jour le fournisseur par défaut côté serveur.
 */
export async function setAIProvider(provider: AIProviderId): Promise<boolean> {
  const response = await fetch('/api/ai/provider', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
  return response.ok;
}
