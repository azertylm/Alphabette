/**
 * @file localLLMClient.ts
 * Module TypeScript de client d'inférence locale pour Ollama / vLLM.
 *
 * Fonctionnalités clés :
 * - Connexion par défaut à http://localhost:11434 (ou instance vLLM OpenAI-compatible).
 * - Streaming temps réel de tokens via l'API standard fetch (ReadableStream / TextDecoder).
 * - Gestion granulaire de l'annulation via AbortController / AbortSignal.
 * - Détection automatique des erreurs de mémoire (OOM / VRAM / CUDA Out Of Memory).
 * - Bascule automatique transparente (Fallback) vers un modèle plus léger en cas de saturation RAM/VRAM.
 * - Typage strict TypeScript de toutes les entrées/sorties et métadonnées d'inférence.
 */

// ============================================================================
// Types stricts & Interfaces
// ============================================================================

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: MessageRole;
  content: string;
  name?: string;
}

export type LLMProtocol = 'ollama' | 'vllm' | 'auto';

export interface LocalLLMConfig {
  /**
   * URL de base du serveur d'inférence local.
   * @default 'http://localhost:11434'
   */
  baseUrl?: string;

  /**
   * Protocole cible : 'ollama' (/api/chat), 'vllm' (/v1/chat/completions), ou 'auto'.
   * @default 'auto'
   */
  protocol?: LLMProtocol;

  /**
   * Modèle par défaut à utiliser si non spécifié dans la requête.
   * @default 'llama3:8b'
   */
  defaultModel?: string;

  /**
   * Alias pour defaultModel.
   */
  model?: string;

  /**
   * Modèle de repli (plus léger) par défaut en cas d'erreur de mémoire (OOM).
   * @default 'llama3.2:1b'
   */
  defaultFallbackModel?: string;

  /**
   * Timeout réseau par défaut en millisecondes pour la première réponse.
   * @default 60000 (60s)
   */
  timeoutMs?: number;

  /**
   * En-têtes HTTP personnalisés (ex: tokens d'authentification pour vLLM).
   */
  headers?: Record<string, string>;
}

export interface LocalLLMRequestOptions {
  /**
   * Nom ou identifiant du modèle cible (ex: 'llama3:8b', 'mistral:7b', 'qwen2.5:7b').
   */
  model?: string;

  /**
   * Modèle de secours plus léger si le modèle principal déclenche une saturation de mémoire.
   * Si non renseigné, le fallback configuré au niveau du client est utilisé.
   */
  fallbackModel?: string;

  /**
   * Température de génération (0.0 à 2.0).
   * @default 0.7
   */
  temperature?: number;

  /**
   * Top-P / Nucleus sampling (0.0 à 1.0).
   */
  topP?: number;

  /**
   * Nombre maximum de tokens à générer.
   */
  maxTokens?: number;

  /**
   * Séquences de fin de génération.
   */
  stop?: string[];

  /**
   * Format forcé de sortie (ex: 'json' pour mode structuré).
   */
  format?: 'json' | Record<string, unknown>;

  /**
   * Signal d'annulation externe (AbortSignal).
   */
  signal?: AbortSignal;

  /**
   * Timeout d'exécution en ms spécifique à cette requête.
   */
  timeoutMs?: number;

  /**
   * Option de test/simulation : simule une erreur de mémoire OOM sur la première tentative
   * pour valider le mécanisme de bascule automatique vers le modèle plus léger.
   */
  simulateMemoryError?: boolean;

  /**
   * Callback déclenché à chaque nouveau token reçu.
   */
  onToken?: (token: string, accumulatedText: string) => void;

  /**
   * Callback déclenché en cas de bascule automatique vers le modèle de secours pour cause de mémoire.
   */
  onMemoryFallback?: (event: MemoryFallbackEvent) => void;
}

export interface MemoryFallbackEvent {
  originalModel: string;
  fallbackModel: string;
  errorMessage: string;
  attemptNumber: number;
  timestamp: string;
}

export interface TokenChunk {
  /**
   * Token brut ou morceau de texte reçu dans ce chunk.
   */
  token: string;

  /**
   * Texte complet accumulé depuis le début du streaming.
   */
  accumulatedText: string;

  /**
   * Indique si ce chunk termine la génération.
   */
  isDone: boolean;

  /**
   * Modèle actuellement utilisé pour produire la réponse.
   */
  model: string;

  /**
   * Indique si un basculement sur modèle allégé a eu lieu.
   */
  isFallback: boolean;

  /**
   * Modèle initialement demandé avant le fallback (si applicable).
   */
  originalModel?: string;

  /**
   * Métriques télémétriques locales si fournies par le runtime.
   */
  metrics?: {
    totalDurationMs?: number;
    loadDurationMs?: number;
    promptEvalCount?: number;
    evalCount?: number;
    tokensPerSecond?: number;
  };
}

export interface ChatResponse {
  /**
   * Texte complet généré par le modèle.
   */
  text: string;

  /**
   * Modèle qui a effectivement produit la réponse finale.
   */
  modelUsed: string;

  /**
   * Vrai si la réponse a été produite par le modèle de repli suite à une erreur OOM.
   */
  fallbackTriggered: boolean;

  /**
   * Modèle initial avant basculement.
   */
  originalModelRequested?: string;

  /**
   * Raison du repli si déclenché.
   */
  fallbackReason?: string;

  /**
   * Durée totale du traitement en millisecondes.
   */
  durationMs: number;

  /**
   * Décompte de tokens et métriques de débit.
   */
  tokenStats?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    tokensPerSecond?: number;
  };

  /**
   * Message assistant structuré prêt à être réinjecté dans l'historique.
   */
  message: ChatMessage;
}

export interface LocalModelTag {
  name: string;
  model: string;
  sizeBytes: number;
  modifiedAt: string;
  digest?: string;
  details?: {
    parentModel?: string;
    format?: string;
    family?: string;
    parameterSize?: string;
    quantizationLevel?: string;
  };
}

export interface HealthCheckResult {
  isOnline: boolean;
  endpoint: string;
  protocol: 'ollama' | 'vllm' | 'unknown';
  version?: string;
  availableModels: string[];
  latencyMs: number;
  error?: string;
}

// ============================================================================
// Détection des erreurs de mémoire (OOM)
// ============================================================================

/**
 * Liste des motifs textuels caractéristiques d'une saturation mémoire
 * renvoyés par Ollama (llama.cpp / ggml), vLLM (PyTorch / CUDA), ou le GPU/CPU.
 */
const MEMORY_ERROR_PATTERNS: RegExp[] = [
  /out of memory/i,
  /cuda out of memory/i,
  /cuda\s*oom/i,
  /failed to allocate/i,
  /not enough memory/i,
  /insufficient memory/i,
  /insufficient shared memory/i,
  /model requires more system memory/i,
  /requires more memory than is available/i,
  /vram/i,
  /gpu memory/i,
  /torch\.cuda\.OutOfMemoryError/i,
  /llama_model_load: error loading model: unable to allocate/i,
  /GGML_ASSERT\(.*failed to allocate/i,
];

/**
 * Vérifie si une erreur (statut HTTP ou contenu textuel) correspond à une saturation mémoire.
 */
export function isMemoryError(status: number, message: string): boolean {
  // HTTP 507 Insufficient Storage ou HTTP 500 avec diagnostic OOM
  if (status === 507) return true;
  return MEMORY_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

// ============================================================================
// Classe Client Principale : LocalLLMClient
// ============================================================================

export class LocalLLMClient {
  private readonly baseUrl: string;
  private readonly protocol: LLMProtocol;
  private readonly defaultModel: string;
  private readonly defaultFallbackModel: string;
  private readonly defaultTimeoutMs: number;
  private readonly headers: Record<string, string>;

  constructor(config: LocalLLMConfig = {}) {
    // Nettoie l'URL de base (supprime le slash terminal)
    this.baseUrl = (config.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
    this.protocol = config.protocol || 'auto';
    this.defaultModel = config.model || config.defaultModel || 'llama3:8b';
    this.defaultFallbackModel = config.defaultFallbackModel || 'llama3.2:1b';
    this.defaultTimeoutMs = config.timeoutMs ?? 60000;
    this.headers = config.headers || {};
  }

  /**
   * Vérifie la disponibilité du serveur local et identifie le moteur (Ollama vs vLLM).
   */
  public async checkHealth(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    try {
      // 1. Test endpoint Ollama /api/version
      try {
        const ollamaRes = await fetch(`${this.baseUrl}/api/version`, {
          method: 'GET',
          headers: this.headers,
        });

        if (ollamaRes.ok) {
          const data = await ollamaRes.json().catch(() => ({}));
          const models = await this.listModels().catch(() => []);
          return {
            isOnline: true,
            endpoint: this.baseUrl,
            protocol: 'ollama',
            version: data.version || 'Ollama (version non spécifiée)',
            availableModels: models.map((m) => m.name),
            latencyMs: Math.round(performance.now() - startTime),
          };
        }
      } catch {
        // Poursuit sur la sonde vLLM
      }

      // 2. Test endpoint OpenAI/vLLM /v1/models
      const vllmRes = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers: this.headers,
      });

      if (vllmRes.ok) {
        const data = await vllmRes.json().catch(() => ({ data: [] }));
        const modelNames = Array.isArray(data.data)
          ? data.data.map((m: { id?: string }) => m.id || '').filter(Boolean)
          : [];
        return {
          isOnline: true,
          endpoint: this.baseUrl,
          protocol: 'vllm',
          version: 'vLLM / OpenAI-compatible',
          availableModels: modelNames,
          latencyMs: Math.round(performance.now() - startTime),
        };
      }

      return {
        isOnline: false,
        endpoint: this.baseUrl,
        protocol: 'unknown',
        availableModels: [],
        latencyMs: Math.round(performance.now() - startTime),
        error: `Réponse HTTP ${vllmRes.status}`,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isOnline: false,
        endpoint: this.baseUrl,
        protocol: 'unknown',
        availableModels: [],
        latencyMs: Math.round(performance.now() - startTime),
        error: message,
      };
    }
  }

  /**
   * Liste les modèles locaux installés.
   */
  public async listModels(): Promise<LocalModelTag[]> {
    try {
      // Tente Ollama /api/tags
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: this.headers,
      });

      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.models)) {
          return json.models.map((m: any) => ({
            name: m.name || m.model,
            model: m.model || m.name,
            sizeBytes: m.size || 0,
            modifiedAt: m.modified_at || '',
            digest: m.digest,
            details: m.details,
          }));
        }
      }
    } catch {
      // Ignore et tente vLLM
    }

    // Tente vLLM /v1/models
    try {
      const resVllm = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers: this.headers,
      });
      if (resVllm.ok) {
        const json = await resVllm.json();
        if (Array.isArray(json.data)) {
          return json.data.map((m: any) => ({
            name: m.id,
            model: m.id,
            sizeBytes: 0,
            modifiedAt: new Date().toISOString(),
          }));
        }
      }
    } catch {
      // Échec silencieux
    }

    return [];
  }

  /**
   * Génération en streaming token par token (Async Generator).
   * Gère l'annulation via AbortController et la bascule automatique OOM.
   *
   * @example
   * ```ts
   * const client = new LocalLLMClient();
   * const controller = new AbortController();
   *
   * for await (const chunk of client.streamChat(
   *   [{ role: 'user', content: 'Explique le solaire photovoltaïque.' }],
   *   { signal: controller.signal, fallbackModel: 'phi3:mini' }
   * )) {
   *   process.stdout.write(chunk.token);
   *   if (stopCondition) controller.abort();
   * }
   * ```
   */
  public async *streamChat(
    messages: ChatMessage[],
    options: LocalLLMRequestOptions = {}
  ): AsyncGenerator<TokenChunk, void, unknown> {
    const primaryModel = options.model || this.defaultModel;
    const fallbackModel = options.fallbackModel || this.defaultFallbackModel;

    try {
      // 1. Première tentative avec le modèle principal demandé
      yield* this.executeStreamInternal(messages, primaryModel, options, false, primaryModel);
    } catch (error: unknown) {
      // Si l'utilisateur a délibérément annulé la requête, ne pas faire de fallback OOM
      if (this.isAbortError(error)) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      const isOOM = isMemoryError(500, errorMessage);

      // Si erreur de mémoire et qu'un modèle de repli différent est disponible
      if (isOOM && fallbackModel && fallbackModel !== primaryModel) {
        const fallbackEvent: MemoryFallbackEvent = {
          originalModel: primaryModel,
          fallbackModel,
          errorMessage,
          attemptNumber: 2,
          timestamp: new Date().toISOString(),
        };

        if (options.onMemoryFallback) {
          options.onMemoryFallback(fallbackEvent);
        }

        // Relance avec le modèle de secours allégé
        yield* this.executeStreamInternal(messages, fallbackModel, options, true, primaryModel);
        return;
      }

      // Si ce n'est pas une erreur de mémoire ou s'il n'y a pas de fallback possible, propage l'erreur
      throw error;
    }
  }

  /**
   * Méthode d'exécution complète (promesse classique) accumulant l'intégralité des tokens streamés.
   */
  public async chat(
    messages: ChatMessage[],
    options: LocalLLMRequestOptions = {}
  ): Promise<ChatResponse> {
    const startTime = performance.now();
    let accumulatedText = '';
    let usedModel = options.model || this.defaultModel;
    let fallbackTriggered = false;
    let originalRequestedModel: string | undefined = undefined;
    let lastMetrics: TokenChunk['metrics'] | undefined = undefined;

    for await (const chunk of this.streamChat(messages, options)) {
      accumulatedText = chunk.accumulatedText;
      usedModel = chunk.model;
      fallbackTriggered = chunk.isFallback;
      originalRequestedModel = chunk.originalModel;
      if (chunk.metrics) {
        lastMetrics = chunk.metrics;
      }
    }

    const durationMs = Math.round(performance.now() - startTime);

    return {
      text: accumulatedText,
      modelUsed: usedModel,
      fallbackTriggered,
      originalModelRequested: fallbackTriggered ? originalRequestedModel : undefined,
      fallbackReason: fallbackTriggered
        ? 'Saturation mémoire GPU/VRAM détectée : bascule automatique sur modèle plus léger'
        : undefined,
      durationMs,
      tokenStats: {
        totalTokens: lastMetrics?.evalCount,
        tokensPerSecond: lastMetrics?.tokensPerSecond,
      },
      message: {
        role: 'assistant',
        content: accumulatedText,
      },
    };
  }

  /**
   * Crée une session de chat interactive avec son propre AbortController
   * permettant d'annuler manuellement le streaming à tout moment.
   */
  public createSession(options: LocalLLMRequestOptions = {}) {
    const controller = new AbortController();
    return {
      controller,
      abort: (reason?: string) => controller.abort(reason),
      stream: (messages: ChatMessage[]) =>
        this.streamChat(messages, { ...options, signal: controller.signal }),
      chat: (messages: ChatMessage[]) =>
        this.chat(messages, { ...options, signal: controller.signal }),
    };
  }

  // ==========================================================================
  // Implémentation interne du streaming HTTP
  // ==========================================================================

  private async *executeStreamInternal(
    messages: ChatMessage[],
    model: string,
    options: LocalLLMRequestOptions,
    isFallback: boolean,
    originalModel: string
  ): AsyncGenerator<TokenChunk, void, unknown> {
    // Simulation explicite pour tests & démonstration de la bascule OOM
    if (options.simulateMemoryError && !isFallback) {
      throw new Error(
        `CUDA out of memory: tried to allocate 4.20 GiB (GPU 0; 8.00 GiB total capacity; 7.82 GiB already allocated; 180.00 MiB free; 7.85 GiB reserved in total by PyTorch) on model ${model}`
      );
    }

    // Prépare le contrôleur d'annulation (combine timeout et signal externe si présent)
    const timeoutController = new AbortController();
    const effectiveTimeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const timeoutTimer = setTimeout(() => {
      timeoutController.abort(new DOMException(`Timeout après ${effectiveTimeoutMs}ms d'attente`, 'TimeoutError'));
    }, effectiveTimeoutMs);

    // Écoute l'annulation externe
    const externalSignal = options.signal;
    const abortHandler = () => {
      timeoutController.abort(externalSignal?.reason);
    };

    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutTimer);
        throw new DOMException('Requête annulée avant envoi', 'AbortError');
      }
      externalSignal.addEventListener('abort', abortHandler, { once: true });
    }

    const effectiveSignal = timeoutController.signal;

    try {
      const isVllm = this.protocol === 'vllm';
      const endpoint = isVllm
        ? `${this.baseUrl}/v1/chat/completions`
        : `${this.baseUrl}/api/chat`;

      const requestBody = isVllm
        ? {
            model,
            messages,
            stream: true,
            temperature: options.temperature ?? 0.7,
            top_p: options.topP,
            max_tokens: options.maxTokens,
            stop: options.stop,
            ...(options.format === 'json' ? { response_format: { type: 'json_object' } } : {}),
          }
        : {
            model,
            messages,
            stream: true,
            format: options.format,
            options: {
              temperature: options.temperature ?? 0.7,
              top_p: options.topP,
              num_predict: options.maxTokens,
              stop: options.stop,
            },
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(requestBody),
        signal: effectiveSignal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        // Vérifie si le statut ou le corps indique un OOM
        if (isMemoryError(response.status, errorText)) {
          throw new Error(
            `Erreur mémoire (HTTP ${response.status}) sur le modèle ${model} : ${errorText || 'Out of memory'}`
          );
        }
        throw new Error(
          `Échec inférence HTTP ${response.status} (${response.statusText}) : ${errorText || 'Erreur inconnue'}`
        );
      }

      if (!response.body) {
        throw new Error('Le flux de réponse HTTP ne contient pas de body exploitable.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';
      const streamStart = performance.now();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // Conserve le reste incomplet dans le buffer
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Protocole vLLM (SSE: "data: {...}")
            if (isVllm) {
              if (trimmed === 'data: [DONE]') {
                const chunk: TokenChunk = {
                  token: '',
                  accumulatedText,
                  isDone: true,
                  model,
                  isFallback,
                  originalModel: isFallback ? originalModel : undefined,
                };
                yield chunk;
                return;
              }

              if (trimmed.startsWith('data: ')) {
                const jsonStr = trimmed.slice(6).trim();
                try {
                  const data = JSON.parse(jsonStr);
                  const token = data.choices?.[0]?.delta?.content || '';
                  if (token) {
                    accumulatedText += token;
                    if (options.onToken) options.onToken(token, accumulatedText);

                    yield {
                      token,
                      accumulatedText,
                      isDone: false,
                      model,
                      isFallback,
                      originalModel: isFallback ? originalModel : undefined,
                    };
                  }
                } catch {
                  // Ignore les fragments SSE invalides
                }
              }
              continue;
            }

            // Protocole Ollama (NDJSON)
            try {
              const data = JSON.parse(trimmed);

              // Détection d'erreur dans le flux Ollama
              if (data.error) {
                if (isMemoryError(500, data.error)) {
                  throw new Error(`Ollama OOM: ${data.error}`);
                }
                throw new Error(`Ollama stream error: ${data.error}`);
              }

              const token = data.message?.content || data.response || '';
              const isDone = Boolean(data.done);

              if (token) {
                accumulatedText += token;
                if (options.onToken) options.onToken(token, accumulatedText);
              }

              let metrics: TokenChunk['metrics'] | undefined = undefined;
              if (isDone && data.eval_count && data.eval_duration) {
                const evalSec = data.eval_duration / 1e9;
                metrics = {
                  totalDurationMs: data.total_duration ? Math.round(data.total_duration / 1e6) : Math.round(performance.now() - streamStart),
                  loadDurationMs: data.load_duration ? Math.round(data.load_duration / 1e6) : undefined,
                  promptEvalCount: data.prompt_eval_count,
                  evalCount: data.eval_count,
                  tokensPerSecond: evalSec > 0 ? Number((data.eval_count / evalSec).toFixed(1)) : undefined,
                };
              }

              yield {
                token,
                accumulatedText,
                isDone,
                model,
                isFallback,
                originalModel: isFallback ? originalModel : undefined,
                metrics,
              };

              if (isDone) return;
            } catch (err: unknown) {
              // Si l'erreur provient de la détection OOM ci-dessus, relance
              if (err instanceof Error && err.message.startsWith('Ollama OOM')) {
                throw err;
              }
              // Fragment de ligne incomplet ou format NDJSON temporairement tronqué
            }
          }
        }

        // Fin du flux si pas de balise done explicite reçue
        yield {
          token: '',
          accumulatedText,
          isDone: true,
          model,
          isFallback,
          originalModel: isFallback ? originalModel : undefined,
        };
      } finally {
        reader.releaseLock();
      }
    } finally {
      clearTimeout(timeoutTimer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', abortHandler);
      }
    }
  }

  private isAbortError(error: unknown): boolean {
    if (!error) return false;
    if (error instanceof DOMException && error.name === 'AbortError') return true;
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) return true;
    return false;
  }
}

// ============================================================================
// Instance par défaut (Singleton prêt à l'emploi) & fonctions utilitaires
// ============================================================================

export const localLLMClient = new LocalLLMClient();

/**
 * Fonction raccourcie pour streamer un prompt texte simple vers Ollama/vLLM.
 */
export async function* streamPrompt(
  prompt: string,
  options: LocalLLMRequestOptions = {}
): AsyncGenerator<TokenChunk, void, unknown> {
  const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
  yield* localLLMClient.streamChat(messages, options);
}

/**
 * Fonction raccourcie pour obtenir une réponse complète avec fallback automatique.
 */
export async function askLocalLLM(
  prompt: string,
  options: LocalLLMRequestOptions = {}
): Promise<ChatResponse> {
  const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
  return localLLMClient.chat(messages, options);
}

export default LocalLLMClient;
