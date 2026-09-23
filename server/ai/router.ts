import { 
  AIProviderId, 
  AIRequestOptions, 
  AIResponsePayload, 
  AITelemetry, 
  EffectiveProviderUsed, 
  SovereigntyLevel 
} from "./types";
import { callGemini } from "./providers/geminiProvider";
import { callLocalAI } from "./providers/localOllamaProvider";
import { callMistralCloud } from "./providers/mistralCloudProvider";
import { getExpertFallbackResponse } from "./expertRules";

export class SovereignAIRouter {
  private defaultProvider: AIProviderId;

  constructor() {
    this.defaultProvider = (process.env.AI_PROVIDER as AIProviderId) || 'gemini';
  }

  public getDefaultProvider(): AIProviderId {
    return (process.env.AI_PROVIDER as AIProviderId) || this.defaultProvider;
  }

  public setDefaultProvider(provider: AIProviderId) {
    this.defaultProvider = provider;
  }

  /**
   * Point d'entrée unifié: askAI(prompt, options)
   * Exécute la stratégie d'inférence en respectant les 3 phases de la feuille de route ALPHABETTE.
   */
  public async askAI(prompt: string, options: AIRequestOptions = {}): Promise<AIResponsePayload> {
    const startTime = Date.now();
    const requestedProvider: AIProviderId = options.provider || this.getDefaultProvider();
    
    // CAS 1: Mode Prototypage (Phase 1) - Google Gemini
    if (requestedProvider === 'gemini') {
      try {
        const result = await callGemini(prompt, options);
        const latencyMs = Date.now() - startTime;
        
        const telemetry: AITelemetry = {
          providerRequested: 'gemini',
          providerUsed: 'gemini',
          model: result.model,
          latencyMs,
          fallbackTriggered: false,
          sovereigntyLevel: 'development_sandbox',
          sovereigntyBadge: 'Phase 1 : Bac à sable Prototypage (Google Gemini)',
          serverLocation: 'Google AI Studio Sandbox (Transit sécurisé)',
          carbonEcoRating: 'B+ (Calcul cloud optimisé)',
          timestamp: new Date().toISOString(),
        };

        return {
          text: result.text,
          telemetry,
          appContext: options.appContext,
        };
      } catch (geminiError: any) {
        console.warn("[AI_ROUTER] Gemini a échoué ou clé non renseignée, bascule vers moteur souverain local/expert:", geminiError.message);
        // Secours gracieux si Gemini échoue en phase de dév
        const fallbackText = getExpertFallbackResponse(options.appContext, prompt);
        const latencyMs = Date.now() - startTime;
        
        return {
          text: `${fallbackText}\n\n*(Note système : Traitement complété via le moteur de règles souverain suite à l'indisponibilité du sandbox Gemini).*`,
          telemetry: {
            providerRequested: 'gemini',
            providerUsed: 'sovereign_rule_engine',
            model: 'Algorithme Frugal ALPHABETTE v1',
            latencyMs,
            fallbackTriggered: true,
            fallbackReason: `Gemini indisponible: ${geminiError.message}`,
            sovereigntyLevel: 'local_strict',
            sovereigntyBadge: 'Secours Souverain Frugal Activé',
            serverLocation: 'Serveur OVH France (alphabette.fr)',
            carbonEcoRating: 'A+ (0g CO2 calcul direct)',
            timestamp: new Date().toISOString(),
          },
          appContext: options.appContext,
        };
      }
    }

    // CAS 2: Mode Hybride Cible (Phases 2 & 3) - Serveur Local -> Fallback Transparent Mistral Cloud
    if (requestedProvider === 'hybrid_mistral') {
      let localFailureReason: string | null = null;

      // Étape 1 : Tentative sur le serveur local haute performance
      try {
        const localResult = await callLocalAI(prompt, options);
        const latencyMs = Date.now() - startTime;

        const telemetry: AITelemetry = {
          providerRequested: 'hybrid_mistral',
          providerUsed: 'local_server',
          model: localResult.model,
          latencyMs,
          fallbackTriggered: false,
          sovereigntyLevel: 'local_strict',
          sovereigntyBadge: '100% Souverain : Serveur Local Dédié (Coût 0€, Données Enfermées)',
          serverLocation: 'Machine dédiée locale haute performance (In-House France)',
          carbonEcoRating: 'A+ (Inférence locale décarbonée)',
          timestamp: new Date().toISOString(),
        };

        return {
          text: localResult.text,
          telemetry,
          appContext: options.appContext,
        };
      } catch (localErr: any) {
        localFailureReason = localErr.message || "Serveur local injoignable ou délai dépassé";
        console.log(`[AI_ROUTER - RESILIENCE] ⚠️ Échec serveur local (${localFailureReason}). Bascule automatique transparente vers Mistral AI Cloud France...`);
      }

      // Étape 2 : Secours transparent vers Mistral AI Cloud France
      try {
        const mistralResult = await callMistralCloud(prompt, options);
        const latencyMs = Date.now() - startTime;

        const telemetry: AITelemetry = {
          providerRequested: 'hybrid_mistral',
          providerUsed: 'mistral_cloud_fallback',
          model: mistralResult.model,
          latencyMs,
          fallbackTriggered: true,
          fallbackReason: `Serveur local indisponible (${localFailureReason}). Bascule transparente vers le secours Cloud Mistral AI France réussie.`,
          sovereigntyLevel: 'european_cloud',
          sovereigntyBadge: 'Secours Cloud Souverain : Mistral AI (Paris, France)',
          serverLocation: 'Datacenter Européen sécurisé (France)',
          carbonEcoRating: 'A (PUE < 1.20 - Énergie décarbonée européenne)',
          timestamp: new Date().toISOString(),
        };

        return {
          text: mistralResult.text,
          telemetry,
          appContext: options.appContext,
        };
      } catch (mistralErr: any) {
        console.warn(`[AI_ROUTER - RESILIENCE] ⚠️ Échec Mistral Cloud (${mistralErr.message}). Utilisation du moteur algorithmique de continuité ALPHABETTE.`);
        
        // Étape 3 : Si même le cloud Mistral est hors ligne (panne majeure internet), le moteur de règles souverain prend le relais
        const fallbackText = getExpertFallbackResponse(options.appContext, prompt);
        const latencyMs = Date.now() - startTime;

        const telemetry: AITelemetry = {
          providerRequested: 'hybrid_mistral',
          providerUsed: 'sovereign_rule_engine',
          model: 'Moteur Algorithmique Résilient ALPHABETTE',
          latencyMs,
          fallbackTriggered: true,
          fallbackReason: `Bascule hybride: Serveur local (${localFailureReason}) et secours Mistral Cloud (${mistralErr.message}) injoignables. Moteur autonome de secours activé.`,
          sovereigntyLevel: 'local_strict',
          sovereigntyBadge: 'Moteur Autonome de Secours (Continuité de Service 100%)',
          serverLocation: 'Serveur OVH France (alphabette.fr)',
          carbonEcoRating: 'A+ (Calcul immédiat)',
          timestamp: new Date().toISOString(),
        };

        return {
          text: fallbackText,
          telemetry,
          appContext: options.appContext,
        };
      }
    }

    // CAS 3: Mode Local Forcé
    if (requestedProvider === 'local') {
      try {
        const localResult = await callLocalAI(prompt, options);
        const latencyMs = Date.now() - startTime;

        return {
          text: localResult.text,
          telemetry: {
            providerRequested: 'local',
            providerUsed: 'local_server',
            model: localResult.model,
            latencyMs,
            fallbackTriggered: false,
            sovereigntyLevel: 'local_strict',
            sovereigntyBadge: 'Serveur Local Dédié Forcé',
            serverLocation: 'Machine dédiée locale haute performance (France)',
            carbonEcoRating: 'A+ (0g émission réseau externe)',
            timestamp: new Date().toISOString(),
          },
          appContext: options.appContext,
        };
      } catch (err: any) {
        throw new Error(`Serveur local non joignable (mode local forcé) : ${err.message}`);
      }
    }

    // CAS 4: Mode Mistral Cloud Forcé
    if (requestedProvider === 'mistral_cloud') {
      try {
        const mistralResult = await callMistralCloud(prompt, options);
        const latencyMs = Date.now() - startTime;

        return {
          text: mistralResult.text,
          telemetry: {
            providerRequested: 'mistral_cloud',
            providerUsed: 'mistral_cloud',
            model: mistralResult.model,
            latencyMs,
            fallbackTriggered: false,
            sovereigntyLevel: 'european_cloud',
            sovereigntyBadge: 'Mistral AI Cloud France (Direct)',
            serverLocation: 'Datacenter Européen sécurisé (France)',
            carbonEcoRating: 'A (Électricité bas-carbone France)',
            timestamp: new Date().toISOString(),
          },
          appContext: options.appContext,
        };
      } catch (err: any) {
        // En cas d'erreur sur Mistral direct, secours gracieux
        const fallbackText = getExpertFallbackResponse(options.appContext, prompt);
        const latencyMs = Date.now() - startTime;

        return {
          text: `${fallbackText}\n\n*(Note : L'API Mistral a rencontré une interruption temporaire : ${err.message})*`,
          telemetry: {
            providerRequested: 'mistral_cloud',
            providerUsed: 'sovereign_rule_engine',
            model: 'Secours Frugal ALPHABETTE',
            latencyMs,
            fallbackTriggered: true,
            fallbackReason: err.message,
            sovereigntyLevel: 'local_strict',
            sovereigntyBadge: 'Secours Local Activé',
            serverLocation: 'Serveur OVH France',
            carbonEcoRating: 'A+',
            timestamp: new Date().toISOString(),
          },
          appContext: options.appContext,
        };
      }
    }

    throw new Error(`Fournisseur d'IA non reconnu: ${requestedProvider}`);
  }
}

export const sovereignAIRouter = new SovereignAIRouter();
