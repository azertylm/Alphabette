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
  | 'local_strict'       // Inférence 100% sur machine locale, 0 donnée extérieure
  | 'european_cloud'     // Mistral AI hébergé en France / UE, 100% RGPD
  | 'development_sandbox'; // Google Gemini (Phase 1 de prototypage)

export interface AIRequestOptions {
  appContext?: string; // ex: 'LIDARSOL', 'OSOLAR', 'PROXILIEN', 'INFOS PERSO', 'ATELIER 3D'
  systemPrompt?: string;
  provider?: AIProviderId;
  temperature?: number;
  maxTokens?: number;
  simulateLocalFailure?: boolean; // Utile pour tester la résilience et la bascule transparente en direct
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
  carbonEcoRating: string; // ex: 'A+ (0g CO2 - Énergie solaire locale)' ou 'A (Data center PUE 1.15 France)'
  timestamp: string;
}

export interface AIResponsePayload {
  text: string;
  telemetry: AITelemetry;
  appContext?: string;
}
