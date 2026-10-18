import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  ShieldCheck, 
  Leaf, 
  Server, 
  Zap, 
  RefreshCw, 
  Send, 
  Lock, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  Code2, 
  Sliders, 
  Clock, 
  HelpCircle,
  Sun,
  Flame,
  Users,
  Newspaper,
  Layers,
  Copy,
  Check,
  Scale,
  HeartHandshake,
  ChevronDown,
  ChevronUp,
  Square,
  Play,
  Terminal,
  Activity,
  ListOrdered,
  HardDrive,
  BarChart3,
  Plus,
  Trash2,
  Film,
  Database,
  FileKey2,
  Download,
  Search,
  FileText
} from 'lucide-react';
import { 
  askAI, 
  getAIConfig, 
  setAIProvider, 
  AIProviderId, 
  AIResponsePayload, 
  AITelemetry, 
  AIConfigResponse 
} from '../services/aiService';
import { 
  LocalLLMClient, 
  MemoryFallbackEvent, 
  HealthCheckResult 
} from '../services/localLLMClient';
import {
  globalTaskQueue,
  QueueStatsSnapshot,
  LoadBalancingStrategy,
  GpuId
} from '../services/TaskQueue';
import {
  buildVisualContinuityPrompt,
  CharacterSheet,
  ShotActionOptions,
  CompiledContinuityPrompt
} from '../services/visualContinuityPromptBuilder';
import {
  localSemanticRAG,
  SemanticSearchResult
} from '../services/localSemanticRAG';
import {
  AutonomousProjectExporter,
  AutonomousProjectData,
  EncryptedProjectPackage
} from '../services/autonomousProjectExporter';
import { UserProfile } from '../types';
import { PRICES, isAppPlan, isEcosystemPlan } from '../plans';

interface SovereignAiStudioProps {
  user: UserProfile;
  onOpenPricing: () => void;
  defaultAppContext?: string;
}

interface AppPreset {
  id: string;
  name: string;
  category: string;
  icon: React.ReactNode;
  promptExample: string;
  systemHint: string;
}

const APP_PRESETS: AppPreset[] = [
  {
    id: 'LIDARSOL',
    name: 'LIDARSOL',
    category: 'B2B Solaire',
    icon: <Sun className="w-4 h-4 text-amber-500" />,
    promptExample: 'Analyser la toiture d\'un hangar de 600 m² à partir des données LiDAR HD de l\'IGN : déterminer l\'inclinaison optimale, la détection des ombrages portés et la surface photovoltaïque utile.',
    systemHint: 'Modélisation 3D LiDAR HD IGN, calcul du potentiel solaire de toiture et surface utile'
  },
  {
    id: 'OSOLAR',
    name: 'OSOLAR',
    category: 'B2B Solaire',
    icon: <Zap className="w-4 h-4 text-amber-600" />,
    promptExample: 'Chiffrage commercial et dimensionnement technico-financier d\'une installation photovoltaïque de 36 kWc en autoconsommation avec revente du surplus.',
    systemHint: 'Dimensionnement photovoltaïque professionnel, chiffrage commercial et analyse de rentabilité'
  },
  {
    id: 'PROXILIEN',
    name: 'PROXILIEN',
    category: 'Citoyen & Proximité',
    icon: <HeartHandshake className="w-4 h-4 text-rose-500" />,
    promptExample: 'Phase pilote La Grande-Motte : organiser une entraide de voisinage pour le covoiturage solidaire et les démarches administratives locales.',
    systemHint: 'Plateforme d\'entraide locale, communication de proximité et lien civique communal'
  },
  {
    id: 'IADEBAT',
    name: 'IADÉBAT',
    category: 'Citoyen & Proximité',
    icon: <Scale className="w-4 h-4 text-indigo-600" />,
    promptExample: 'Présenter de façon strictement neutre et contradictoire les arguments pour et contre la tarification progressive de l\'eau potable dans les stations balnéaires.',
    systemHint: 'Décryptage citoyen, neutralité absolue et argumentation contradictoire équilibrée'
  },
  {
    id: 'INFOS PERSO',
    name: 'INFOS PERSO',
    category: 'Citoyen & Proximité',
    icon: <Newspaper className="w-4 h-4 text-blue-600" />,
    promptExample: 'Structurer une checklist sécurisée des pièces justificatives obligatoires pour une demande d\'aide au logement (CAF) et d\'aide à la rénovation énergétique.',
    systemHint: 'Gestionnaire personnel sécurisé facilitant l\'accès aux démarches et renseignements de la vie courante'
  },
  {
    id: 'OEIL_ATELIER',
    name: "L'ŒIL DE L'ATELIER",
    category: 'Citoyen & Proximité',
    icon: <Layers className="w-4 h-4 text-amber-700" />,
    promptExample: 'Créer une fiche de suivi photographique et de métré journalier pour un chantier de rénovation de plomberie et électricité chez un particulier.',
    systemHint: 'Solution dédiée aux artisans pour le suivi, la documentation et la gestion simplifiée de leurs chantiers'
  },
  {
    id: 'FRANCE_SERVICE',
    name: 'FRANCE SERVICE',
    category: 'Zero-Knowledge',
    icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />,
    promptExample: 'Vérifier localement sur l\'appareil (Zero-Knowledge) les clauses d\'un bail locatif pour détecter les clauses abusives selon la loi ALUR (ClairContrat).',
    systemHint: 'Suite pratique d\'utilité publique familiale 100% locale (Zero-Knowledge) regroupant 7 modules souverains'
  }
];

export const SovereignAiStudio: React.FC<SovereignAiStudioProps> = ({
  user,
  onOpenPricing,
  defaultAppContext = 'LIDARSOL'
}) => {
  const [selectedPreset, setSelectedPreset] = useState<AppPreset>(
    APP_PRESETS.find(p => p.id === defaultAppContext) || APP_PRESETS[0]
  );
  const [prompt, setPrompt] = useState<string>(selectedPreset.promptExample);
  const [provider, setProvider] = useState<AIProviderId>('gemini');
  const [simulateLocalFailure, setSimulateLocalFailure] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [responsePayload, setResponsePayload] = useState<AIResponsePayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tester' | 'architecture' | 'local_client' | 'task_queue' | 'video_continuity' | 'local_rag' | 'project_export' | 'env'>('tester');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [serverConfig, setServerConfig] = useState<AIConfigResponse | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(true);

  // --- États Prompt 3 : Continuité Visuelle Vidéo ---
  const [charName, setCharName] = useState<string>('Alexandre Vane');
  const [charAge, setCharAge] = useState<string>('37 years old');
  const [charTraits, setCharTraits] = useState<string>('piercing slate-gray eyes, sharp jawline, stubble beard, short textured dark brown hair');
  const [charOutfit, setCharOutfit] = useState<string>('bespoke midnight navy wool trench coat, crisp charcoal turtleneck sweater, titanium analog wristwatch');
  const [shotAction, setShotAction] = useState<string>('calmly unrolls a high-resolution solar irradiance topographic map on the oak table, taps index finger firmly on south-facing azimuth, then looks straight up toward the skylight');
  const [shotFraming, setShotFraming] = useState<any>('medium_close_up');
  const [shotLighting, setShotLighting] = useState<any>('cinematic_soft_rembrandt');
  const [shotModel, setShotModel] = useState<any>('wan2gp');
  const [compiledVideoPrompt, setCompiledVideoPrompt] = useState<CompiledContinuityPrompt | null>(null);

  // --- États Prompt 4 : RAG 100% Local (Dexie + Cosine) ---
  const [ragDocTitle, setRagDocTitle] = useState<string>('Spécifications Techniques ALPHABETTE V1');
  const [ragMarkdown, setRagMarkdown] = useState<string>(`# Architecture Souveraine ALPHABETTE

## 1. Cadastre Solaire et Photovoltaïque
Le module LIDARSOL calcule le potentiel photovoltaïque en combinant les scans LiDAR IGN avec un maillage haute précision. L'algorithme calcule l'ombrage dynamique heure par heure et simule les kWh/an pour chaque pan de toiture.

## 2. Inférence Locale Multi-GPU
Le gestionnaire TaskQueue route automatiquement les requêtes vers deux endpoints locaux : GPU 0 sur le port 11434 et GPU 1 sur le port 11435. Le dépilage est strictement FIFO et assure un débit supérieur à 40 tokens/seconde avec une latence VRAM mesurée en millisecondes.

## 3. Cryptographie et Chiffrement Zéro Serveur
Tous les exports de projet sont chiffrés côté client avec SubtleCrypto en AES-GCM 256 bits et dérivation PBKDF2 (100 000 itérations). Aucune clé n'est transmise sur le réseau.`);
  const [ragQuery, setRagQuery] = useState<string>('Comment fonctionne le calcul d\'ombrage sur les toitures solaires ?');
  const [ragResults, setRagResults] = useState<SemanticSearchResult[]>([]);
  const [isIndexingRag, setIsIndexingRag] = useState<boolean>(false);
  const [isSearchingRag, setIsSearchingRag] = useState<boolean>(false);
  const [ragIndexedCount, setRagIndexedCount] = useState<number>(0);

  // --- États Prompt 5 : Export & Import Autonome Chiffré ---
  const [exportPassphrase, setExportPassphrase] = useState<string>('CleSouveraine2026!');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [exportPackageResult, setExportPackageResult] = useState<EncryptedProjectPackage | null>(null);
  const [decryptedProjectPreview, setDecryptedProjectPreview] = useState<AutonomousProjectData | null>(null);
  const [cryptoError, setCryptoError] = useState<string | null>(null);

  // États pour la file d'attente FIFO et répartition multi-GPU (TaskQueue)
  const [queueSnapshot, setQueueSnapshot] = useState<QueueStatsSnapshot>(globalTaskQueue.getSnapshot());
  const [queuePrompt, setQueuePrompt] = useState<string>('Analyse cadastrale express : calcule le potentiel d\'irradiation pour 45m² de toiture.');
  const [queuePriority, setQueuePriority] = useState<number>(0);
  const [queuePreferredGpu, setQueuePreferredGpu] = useState<string>('auto');
  const [completedQueueTasks, setCompletedQueueTasks] = useState<Array<{
    id: string;
    prompt: string;
    gpuId: string;
    inferenceTimeMs: number;
    queueWaitTimeMs: number;
    tokensPerSecond: number;
    text: string;
  }>>([]);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState<boolean>(false);

  // Inscription aux mises à jour en direct de globalTaskQueue
  useEffect(() => {
    const unsubscribe = globalTaskQueue.subscribe((snap) => {
      setQueueSnapshot(snap);
    });
    return () => unsubscribe();
  }, []);

  // États pour le test en direct du module localLLMClient
  const [localEndpoint, setLocalEndpoint] = useState<string>('http://localhost:11434');
  const [localModel, setLocalModel] = useState<string>('llama3:8b');
  const [localFallbackModel, setLocalFallbackModel] = useState<string>('llama3.2:1b');
  const [localPrompt, setLocalPrompt] = useState<string>('Explique la souveraineté numérique et le fonctionnement en Zero-Knowledge en 2 phrases.');
  const [isLocalStreaming, setIsLocalStreaming] = useState<boolean>(false);
  const [localStreamText, setLocalStreamText] = useState<string>('');
  const [localTokenCount, setLocalTokenCount] = useState<number>(0);
  const [localStreamModelUsed, setLocalStreamModelUsed] = useState<string>('');
  const [localFallbackEvent, setLocalFallbackEvent] = useState<MemoryFallbackEvent | null>(null);
  const [localSimulateOOM, setLocalSimulateOOM] = useState<boolean>(true);
  const [localAbortController, setLocalAbortController] = useState<AbortController | null>(null);
  const [localHealth, setLocalHealth] = useState<HealthCheckResult | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Load server config on mount
  useEffect(() => {
    getAIConfig()
      .then(cfg => {
        setServerConfig(cfg);
        if (cfg.activeProvider) {
          setProvider(cfg.activeProvider);
        }
      })
      .catch(err => {
        console.warn("Impossible de contacter /api/ai/config:", err);
      });
  }, []);

  // Update prompt when preset changes
  const handleSelectPreset = (preset: AppPreset) => {
    setSelectedPreset(preset);
    setPrompt(preset.promptExample);
    setResponsePayload(null);
    setErrorMsg(null);
  };

  // Run AI Query
  const handleRunQuery = async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const result = await askAI(prompt.trim(), {
        appContext: selectedPreset.id,
        provider: provider,
        simulateLocalFailure: simulateLocalFailure,
      });
      setResponsePayload(result);
    } catch (err: any) {
      console.error("Erreur askAI:", err);
      setErrorMsg(err.message || "Une erreur est survenue lors de l'exécution de la requête.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCheckLocalHealth = async () => {
    setIsCheckingHealth(true);
    setLocalError(null);
    try {
      const client = new LocalLLMClient({ baseUrl: localEndpoint });
      const health = await client.checkHealth();
      setLocalHealth(health);
    } catch (err: any) {
      setLocalError(err.message || "Erreur de vérification");
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleStartLocalStream = async () => {
    setIsLocalStreaming(true);
    setLocalStreamText('');
    setLocalTokenCount(0);
    setLocalStreamModelUsed(localModel);
    setLocalFallbackEvent(null);
    setLocalError(null);

    const controller = new AbortController();
    setLocalAbortController(controller);

    const client = new LocalLLMClient({
      baseUrl: localEndpoint,
      defaultModel: localModel,
      defaultFallbackModel: localFallbackModel,
    });

    try {
      for await (const chunk of client.streamChat(
        [{ role: 'user', content: localPrompt }],
        {
          model: localModel,
          fallbackModel: localFallbackModel,
          simulateMemoryError: localSimulateOOM,
          signal: controller.signal,
          onMemoryFallback: (event) => {
            setLocalFallbackEvent(event);
            setLocalStreamModelUsed(event.fallbackModel);
          },
        }
      )) {
        setLocalStreamText(chunk.accumulatedText);
        setLocalStreamModelUsed(chunk.model);
        setLocalTokenCount((prev) => prev + 1);
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('annulée')) {
        setLocalError('Streaming interrompu avec succès par l\'utilisateur (AbortController).');
      } else {
        setLocalError(
          err.message ||
          `Impossible de joindre l'instance locale sur ${localEndpoint}. Lancez 'ollama serve' ou 'ollama run ${localModel}'.`
        );
      }
    } finally {
      setIsLocalStreaming(false);
      setLocalAbortController(null);
    }
  };

  const handleAbortLocalStream = () => {
    if (localAbortController) {
      localAbortController.abort();
    }
  };

  // Handlers pour la file d'attente FIFO multi-GPU (TaskQueue)
  const handleEnqueueSingle = async () => {
    if (!queuePrompt.trim()) return;

    try {
      const preferred = queuePreferredGpu === 'auto' ? undefined : (queuePreferredGpu as GpuId);
      const { taskId, promise } = globalTaskQueue.enqueue(queuePrompt, {
        priority: queuePriority,
        preferredGpu: preferred,
      });

      // Attendre la résolution asynchrone avec mesure d'inférence en ms
      promise.then((res) => {
        setCompletedQueueTasks((prev) => [
          {
            id: taskId,
            prompt: queuePrompt,
            gpuId: res.metrics.assignedGpuId || 'gpu-0',
            inferenceTimeMs: res.metrics.inferenceTimeMs,
            queueWaitTimeMs: res.metrics.queueWaitTimeMs,
            tokensPerSecond: res.metrics.tokensPerSecond,
            text: res.text,
          },
          ...prev.slice(0, 14), // Garde les 15 plus récentes
        ]);
      }).catch((err) => {
        console.warn('Tâche de file annulée ou échouée:', err);
      });
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l\'ajout à la file');
    }
  };

  const handleEnqueueBatch = async (count: number = 4) => {
    setIsSubmittingBatch(true);
    const samplePrompts = [
      'Génération acte sous seing privé : clause de réserve de propriété et délai de rétractation.',
      'Audit thermique : estimation des déperditions toiture et gains solaires en kWh/an.',
      'Contrôle anti-phishing : vérification des SPF, DKIM et DMARC d\'un expéditeur suspect.',
      'Calcul des droits de succession en ligne directe avec abattement fiscal légal.',
    ];

    for (let i = 0; i < count; i++) {
      const p = samplePrompts[i % samplePrompts.length];
      const { taskId, promise } = globalTaskQueue.enqueue(p, {
        priority: i === 0 ? 1 : 0, // Première tâche prioritaire
      });

      promise.then((res) => {
        setCompletedQueueTasks((prev) => [
          {
            id: taskId,
            prompt: p,
            gpuId: res.metrics.assignedGpuId || 'gpu-0',
            inferenceTimeMs: res.metrics.inferenceTimeMs,
            queueWaitTimeMs: res.metrics.queueWaitTimeMs,
            tokensPerSecond: res.metrics.tokensPerSecond,
            text: res.text,
          },
          ...prev.slice(0, 14),
        ]);
      }).catch(() => {});
    }

    setTimeout(() => setIsSubmittingBatch(false), 300);
  };

  const handleCancelQueueTask = (id: string) => {
    globalTaskQueue.cancelTask(id);
  };

  const handleClearQueue = () => {
    globalTaskQueue.clearQueue();
  };

  const handleStrategyChange = (st: LoadBalancingStrategy) => {
    globalTaskQueue.setStrategy(st);
  };

  // --- Handlers Prompt 3 : Continuité Visuelle Vidéo ---
  const handleCompileVideoPrompt = () => {
    const character: CharacterSheet = {
      name: charName,
      age: charAge,
      facialFeatures: charTraits,
      lockedOutfit: charOutfit,
      buildAndStature: '182cm athletic lean frame, upright cinematic posture',
      distinctiveMarks: 'sharp gaze, distinguished hairline, zero temporal alteration',
    };

    const options: ShotActionOptions = {
      action: shotAction,
      framing: shotFraming,
      lighting: shotLighting,
      targetModel: shotModel,
      aspectRatio: '16:9',
      framerateFps: 24,
      emotion: 'subtle calculating focus and absolute determination',
      environment: 'sovereign digital engineering office, architectural drawings and amber evening backlight through acoustic glass',
    };

    const compiled = buildVisualContinuityPrompt(character, options);
    setCompiledVideoPrompt(compiled);
  };

  // --- Handlers Prompt 4 : RAG 100% Local ---
  const handleIndexRagDoc = async () => {
    setIsIndexingRag(true);
    try {
      const count = await localSemanticRAG.indexDocument(
        'doc-tech-v1',
        ragDocTitle,
        ragMarkdown,
        { maxChunkChars: 400 }
      );
      setRagIndexedCount(count);
      // Auto-recherche sur la requête courante
      const results = await localSemanticRAG.searchSemantic(ragQuery, 3);
      setRagResults(results);
    } catch (err: any) {
      console.error('Erreur indexation RAG:', err);
    } finally {
      setIsIndexingRag(false);
    }
  };

  const handleSearchRag = async () => {
    setIsSearchingRag(true);
    try {
      const results = await localSemanticRAG.searchSemantic(ragQuery, 3);
      setRagResults(results);
    } catch (err: any) {
      console.error('Erreur recherche RAG:', err);
    } finally {
      setIsSearchingRag(false);
    }
  };

  // --- Handlers Prompt 5 : Export & Import Autonome Chiffré ---
  const handleExportProject = async () => {
    setIsExporting(true);
    setCryptoError(null);
    try {
      const dummyProject: AutonomousProjectData = {
        schemaVersion: '1.0.0',
        projectId: 'proj-alphabette-2026',
        projectName: 'Sovereign Pipeline Master Studio',
        description: 'Projet d\'animation et d\'inférence autonome locale avec continuité de personnage et RAG embarqué.',
        author: user.name || 'Opérateur ALPHABETTE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scenario: {
          logline: 'Un ingénieur déploie une infrastructure d\'IA locale souveraine pour préserver les secrets industriels.',
          synopsis: 'Dans un contexte de dépendance technologique, l\'équipe bascule sur des clusters GPU isolés.',
          scenes: [
            {
              id: 'sc-1',
              sceneNumber: 1,
              title: 'La Salle des Serveurs Isolée',
              description: 'Examen des deux nœuds RTX 4090 tournant sur ports 11434 et 11435.',
              linkedCharacterIds: ['char-1'],
              visualPrompt: 'Shot 1: Overcoat locked, smooth pan right in cold datacenter.',
            },
            {
              id: 'sc-2',
              sceneNumber: 2,
              title: 'Le Verrouillage Cryptographique',
              description: 'Chiffrement du conteneur projet avec clé AES-GCM 256 bits et sel PBKDF2.',
              linkedCharacterIds: ['char-1'],
            },
          ],
        },
        characters: [
          {
            id: 'char-1',
            name: charName,
            age: charAge,
            traits: charTraits,
            lockedOutfit: charOutfit,
          },
        ],
        technicalSheets: [
          {
            id: 'sheet-1',
            title: 'Fiche Caméra Séquence 1',
            cameraSettings: {
              lens: '50mm Anamorphic T1.8',
              framing: shotFraming,
              lighting: shotLighting,
              aspectRatio: '16:9',
            },
            lightingNotes: '4500K balanced key, zero ambient stray light',
            colorGrade: 'Kodak Vision3 500T emulsion emulation',
            renderTarget: shotModel.toUpperCase(),
          },
        ],
        localFileLinks: [
          {
            id: 'link-1',
            filename: 'render_scene1_wan2gp.mp4',
            localPath: '/opt/alphabette/renders/render_scene1_wan2gp.mp4',
            mimeType: 'video/mp4',
            sizeBytes: 104857600,
          },
          {
            id: 'link-2',
            filename: 'lidar_pointcloud_matrix.las',
            localPath: '/mnt/storage/lidar/pointcloud_matrix.las',
            mimeType: 'application/octet-stream',
          },
        ],
      };

      const pkg = await AutonomousProjectExporter.encryptProject(dummyProject, exportPassphrase);
      setExportPackageResult(pkg);
    } catch (err: any) {
      setCryptoError(err.message || 'Erreur lors du chiffrement du projet.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadEncryptedFile = () => {
    if (exportPackageResult) {
      AutonomousProjectExporter.triggerFileDownload(exportPackageResult, 'projet_souverain_chiffre.alphabette.json');
    }
  };

  const handleTestDecryptProject = async () => {
    if (!exportPackageResult) return;
    setIsImporting(true);
    setCryptoError(null);
    try {
      const decrypted = await AutonomousProjectExporter.decryptAndImportProject(exportPackageResult, exportPassphrase);
      setDecryptedProjectPreview(decrypted);
    } catch (err: any) {
      setCryptoError(err.message || 'Erreur de déchiffrement.');
      setDecryptedProjectPreview(null);
    } finally {
      setIsImporting(false);
    }
  };

  // Check access: Is this app unlocked for the user?
  const isAppUnlocked = 
    isEcosystemPlan(user.subscriptionPlan) ||
    (isAppPlan(user.subscriptionPlan) && user.unlockedAppIds.includes(selectedPreset.id.toLowerCase()));

  return (
    <section id="ai-studio" className="py-12 bg-slate-900 text-slate-100 border-t border-b border-slate-800 relative overflow-hidden">
      
      {/* Background ambient glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header Title & Roadmap summary */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              Moteur d'Inférence IA Souverain & Hybride
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Atelier IA Résilient ALPHABETTE
            </h2>
            <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
              Architecture en couche d'abstraction (Design Pattern Strategy) : pilotez les requêtes en <strong>Phase 1 (Google Gemini)</strong> ou testez en direct la <strong>Phase 2 & 3 (Serveur Local + Secours Mistral AI France)</strong> avec bascule transparente en cas de panne.
            </p>
          </div>

          {/* Collapse / Expand Toggle & Navigation Tabs */}
          <div className="flex items-center gap-2 shrink-0 self-start md:self-auto flex-wrap">
            <button
              onClick={() => setIsStudioOpen(!isStudioOpen)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700 shadow-xs"
            >
              {isStudioOpen ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isStudioOpen ? 'Réduire l\'atelier' : 'Afficher l\'atelier interactif'}</span>
            </button>

            {isStudioOpen && (
              <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 text-xs shrink-0">
                <button
                  onClick={() => setActiveTab('tester')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'tester'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Banc d'Essai</span>
                </button>
                <button
                  onClick={() => setActiveTab('architecture')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'architecture'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Code Routeur</span>
                </button>
                <button
                  onClick={() => setActiveTab('local_client')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'local_client'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Client Ollama/vLLM</span>
                </button>
                <button
                  onClick={() => setActiveTab('task_queue')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'task_queue'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  <span>File Multi-GPU</span>
                </button>
                <button
                  onClick={() => setActiveTab('video_continuity')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'video_continuity'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Continuité Vidéo</span>
                </button>
                <button
                  onClick={() => setActiveTab('local_rag')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'local_rag'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>RAG Local Dexie</span>
                </button>
                <button
                  onClick={() => setActiveTab('project_export')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'project_export'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileKey2 className="w-3.5 h-3.5" />
                  <span>Export Chiffré</span>
                </button>
                <button
                  onClick={() => setActiveTab('env')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'env'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Variables d'Env</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {isStudioOpen && (
          <>

        {/* --- TAB 1: BANC D'ESSAI INTERACTIF --- */}
        {activeTab === 'tester' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Control Column (Presets + Strategy Configuration) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* App Presets */}
              <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    1. Application ALPHABETTE cible
                  </span>
                  <span className="text-[11px] text-emerald-400 font-medium">
                    Catalogue éthique
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {APP_PRESETS.map((preset) => {
                    const isSelected = selectedPreset.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset)}
                        className={`p-3 rounded-xl text-left transition-all border flex items-center gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-slate-800/90 border-emerald-500/60 shadow-md text-white'
                            : 'bg-slate-900/50 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                          {preset.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">{preset.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{preset.category}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Strategy & Provider Selection */}
              <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    2. Stratégie d'Exécution IA
                  </span>
                  <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                    AI_PROVIDER
                  </span>
                </div>

                {/* Provider Options */}
                <div className="space-y-2.5">
                  
                  {/* Option 1: Gemini (Phase 1 Prototypage) */}
                  <label 
                    className={`block p-3.5 rounded-xl border transition-all cursor-pointer ${
                      provider === 'gemini'
                        ? 'bg-blue-950/40 border-blue-500/60 text-white'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="ai_provider"
                        value="gemini"
                        checked={provider === 'gemini'}
                        onChange={() => setProvider('gemini')}
                        className="mt-1 accent-blue-500"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-blue-300">
                            Phase 1 : Google Gemini (Prototypage & Conception)
                          </span>
                          <span className="text-[10px] bg-blue-950 text-blue-400 px-2 py-0.5 rounded-full font-semibold border border-blue-800">
                            Actif Dév
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          SDK Google GenAI côté serveur via <code>GEMINI_API_KEY</code>. Validation complète des fonctionnalités et du rendu UI.
                        </p>
                      </div>
                    </div>
                  </label>

                  {/* Option 2: Hybrid Mistral (Phases 2 & 3 Cible Souveraine) */}
                  <label 
                    className={`block p-3.5 rounded-xl border transition-all cursor-pointer ${
                      provider === 'hybrid_mistral'
                        ? 'bg-emerald-950/40 border-emerald-500/60 text-white'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="ai_provider"
                        value="hybrid_mistral"
                        checked={provider === 'hybrid_mistral'}
                        onChange={() => setProvider('hybrid_mistral')}
                        className="mt-1 accent-emerald-500"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-300">
                            Phases 2 & 3 : Moteur Hybride Résilient (Local + Secours Mistral)
                          </span>
                          <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded-full font-semibold border border-emerald-800">
                            Cible Prod
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          Tente d'abord le serveur local haute performance (0€ d'inférence). En cas d'indisponibilité ou timeout (&gt;3.5s), bascule automatiquement et de manière transparente vers l'API Cloud Mistral AI France.
                        </p>
                      </div>
                    </div>
                  </label>

                  {/* Option 3: Local Only */}
                  <label 
                    className={`block p-3 rounded-xl border transition-all cursor-pointer ${
                      provider === 'local'
                        ? 'bg-slate-800/90 border-slate-500 text-white'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="ai_provider"
                        value="local"
                        checked={provider === 'local'}
                        onChange={() => setProvider('local')}
                        className="accent-slate-400"
                      />
                      <div className="text-xs font-semibold">
                        Phase 2 Pure : Serveur Local Strict (Ollama / vLLM à <code>http://localhost:11434</code>)
                      </div>
                    </div>
                  </label>

                  {/* Option 4: Mistral Cloud Only */}
                  <label 
                    className={`block p-3 rounded-xl border transition-all cursor-pointer ${
                      provider === 'mistral_cloud'
                        ? 'bg-purple-950/40 border-purple-500/60 text-white'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="ai_provider"
                        value="mistral_cloud"
                        checked={provider === 'mistral_cloud'}
                        onChange={() => setProvider('mistral_cloud')}
                        className="accent-purple-400"
                      />
                      <div className="text-xs font-semibold text-purple-300">
                        Phase 3 Pure : Mistral AI Cloud France Direct (Datacenter Paris)
                      </div>
                    </div>
                  </label>

                </div>

                {/* Simulation Toggle: Panne Serveur Local */}
                {provider === 'hybrid_mistral' && (
                  <div className="pt-2 border-t border-slate-800">
                    <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          Simuler panne serveur local (Test de résilience)
                        </div>
                        <div className="text-[10px] text-amber-200/80">
                          Force un échec/timeout pour constater la bascule transparente automatique vers Mistral Cloud sans erreur client.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={simulateLocalFailure}
                        onChange={(e) => setSimulateLocalFailure(e.target.checked)}
                        className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                      />
                    </div>
                  </div>
                )}

              </div>

              {/* Economic Model & Access Rights notice */}
              <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    isEcosystemPlan(user.subscriptionPlan)
                      ? 'bg-emerald-500 text-slate-950'
                      : isAppPlan(user.subscriptionPlan)
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isEcosystemPlan(user.subscriptionPlan) ? '∞' : isAppPlan(user.subscriptionPlan) ? '1' : '0'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Formule {isEcosystemPlan(user.subscriptionPlan) ? 'Écosystème' : isAppPlan(user.subscriptionPlan) ? 'Une application' : 'Découverte'}</span>
                      {isAppUnlocked ? (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Débloqué
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-400 flex items-center gap-0.5 font-medium">
                          <Lock className="w-3 h-3" /> Accès limité
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isAppUnlocked
                        ? `Traitement illimité pour ${selectedPreset.name}`
                        : `${PRICES.perApp} € / an pour cette application seule, ou ${PRICES.ecosystem} € / an pour tout l'écosystème`}
                    </div>
                  </div>
                </div>

                {!isAppUnlocked && (
                  <button
                    onClick={onOpenPricing}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer shadow-sm"
                  >
                    Activer
                  </button>
                )}
              </div>

            </div>

            {/* Right Execution & Output Column */}
            <div className="lg:col-span-7 flex flex-col space-y-4">
              
              {/* Input Prompt Card */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <span>Requête transmise à</span>
                    <span className="text-white font-bold bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                      {selectedPreset.name}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Appel unifié : <code>askAI(prompt, options)</code>
                  </span>
                </div>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  placeholder="Posez votre question ou détaillez le cas d'usage..."
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/50 resize-none font-sans leading-relaxed"
                />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 self-start sm:self-auto">
                    <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Zéro cookie, zéro pistage publicitaire, inférence sécurisée.</span>
                  </div>

                  <button
                    onClick={handleRunQuery}
                    disabled={isLoading || !prompt.trim()}
                    className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                      isLoading || !prompt.trim()
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40 hover:scale-[1.01]'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Inférence en cours...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Exécuter via {provider === 'gemini' ? 'Gemini' : provider === 'hybrid_mistral' ? 'Moteur Hybride' : provider}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Error Display */}
              {errorMsg && (
                <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold">Erreur de traitement IA :</div>
                    <div>{errorMsg}</div>
                  </div>
                </div>
              )}

              {/* Output Result Card */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 flex-1 flex flex-col min-h-[360px] shadow-xl">
                
                {/* Result Top Bar: Sovereignty Badge & Telemetry */}
                <div className="pb-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  
                  {responsePayload ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Sovereignty Badge */}
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                        responsePayload.telemetry.sovereigntyLevel === 'local_strict'
                          ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40'
                          : responsePayload.telemetry.sovereigntyLevel === 'european_cloud'
                          ? 'bg-blue-950/90 text-blue-300 border-blue-500/40'
                          : 'bg-amber-950/90 text-amber-300 border-amber-500/40'
                      }`}>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {responsePayload.telemetry.sovereigntyBadge}
                      </span>

                      {/* Fallback notification chip if triggered */}
                      {responsePayload.telemetry.fallbackTriggered && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-400 border border-amber-500/40 animate-pulse">
                          <Zap className="w-3 h-3" /> Secours transparent activé
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Résultat & Télémétrie Souveraine
                    </div>
                  )}

                  {responsePayload && (
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {responsePayload.telemetry.latencyMs} ms
                      </span>
                      <span>•</span>
                      <span className="text-emerald-400 font-medium">
                        Éco-Score: {responsePayload.telemetry.carbonEcoRating}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content Body */}
                <div className="flex-1 py-4 text-xs sm:text-sm text-slate-300 leading-relaxed font-sans overflow-y-auto max-h-[460px]">
                  {isLoading ? (
                    <div className="space-y-4 animate-pulse py-6">
                      <div className="h-4 bg-slate-800 rounded w-1/3"></div>
                      <div className="space-y-2">
                        <div className="h-3 bg-slate-800/80 rounded"></div>
                        <div className="h-3 bg-slate-800/80 rounded w-5/6"></div>
                        <div className="h-3 bg-slate-800/80 rounded w-4/6"></div>
                      </div>
                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        <span>Routage souverain en cours... Vérification du serveur local ({provider === 'hybrid_mistral' ? 'Ollama' : provider})</span>
                      </div>
                    </div>
                  ) : responsePayload ? (
                    <div className="space-y-4">
                      {/* Fallback Reason banner if triggered */}
                      {responsePayload.telemetry.fallbackTriggered && responsePayload.telemetry.fallbackReason && (
                        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Résilience ALPHABETTE validée : </span>
                            <span>{responsePayload.telemetry.fallbackReason}</span>
                          </div>
                        </div>
                      )}

                      {/* Main text output */}
                      <div className="whitespace-pre-wrap font-sans text-slate-200">
                        {responsePayload.text}
                      </div>

                      {/* Audit Trace Drawer */}
                      <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/60 p-3 rounded-xl">
                        <div>
                          <span className="text-slate-500 block">Modèle effectif :</span>
                          <span className="text-white font-mono">{responsePayload.telemetry.model}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Localisation calcul :</span>
                          <span className="text-white">{responsePayload.telemetry.serverLocation}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Garantie RGPD :</span>
                          <span className="text-emerald-400 font-medium">100% Souveraineté UE</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                        <Cpu className="w-6 h-6" />
                      </div>
                      <div className="text-xs font-semibold text-slate-400">
                        Prêt pour l'inférence souveraine
                      </div>
                      <p className="text-[11px] max-w-sm text-slate-500 leading-normal">
                        Sélectionnez un cas d'usage applicatif à gauche (LIDARSOL, OSOLAR...), choisissez votre stratégie IA puis cliquez sur « Exécuter ».
                      </p>
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>
        )}

        {/* --- TAB 2: CODE DU ROUTEUR (STRATEGY PATTERN) --- */}
        {activeTab === 'architecture' && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-emerald-400" />
                  Routeur Central Souverain (`aiService.ts` & `server/ai/router.ts`)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Design Pattern <strong>Strategy</strong> : Le code applicatif appelle <code>askAI(prompt, options)</code>. Aucune clé n'est exposée au navigateur.
                </p>
              </div>

              <button
                onClick={() => handleCopy(`// ALPHABETTE - Client-side unified call
import { askAI } from './services/aiService';

// Exemple d'appel métier dans LIDARSOL ou OSOLAR :
const result = await askAI("Calculer le gisement solaire pour 80m² de toiture", {
  appContext: 'LIDARSOL',
  provider: 'hybrid_mistral', // Tente serveur local, puis Mistral Cloud si panne
});

console.log(result.text);
console.log("Badge souveraineté:", result.telemetry.sovereigntyBadge);
console.log("Secours activé ?", result.telemetry.fallbackTriggered);`)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copié !' : 'Copier l\'exemple d\'appel'}</span>
              </button>
            </div>

            {/* Architecture Steps */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-blue-900/40 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  Phase 1 (Actuelle)
                </span>
                <div className="font-bold text-white text-sm">Google Gemini Sandbox</div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Utilise <code>@google/genai</code> côté serveur avec <code>GEMINI_API_KEY</code> pour prototyper et valider toutes les interfaces et fonctionnalités.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-900/40 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Phase 2 (Cible In-House)
                </span>
                <div className="font-bold text-white text-sm">Serveur Local Haute Perf</div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Appel prioritaire à <code>http://localhost:11434</code> (Ollama/vLLM - Mistral NeMo). Coût 0€, zéro donnée extérieure.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-purple-900/40 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                  Phase 3 (Résilience)
                </span>
                <div className="font-bold text-white text-sm">Secours Mistral AI Cloud</div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  En cas de timeout (&gt;3.5s) ou coupure de courant du serveur local, bascule automatique vers <code>api.mistral.ai</code> (France/UE) sans erreur utilisateur.
                </p>
              </div>
            </div>

            {/* Code snippet block */}
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
              <pre>{`// server/ai/router.ts - Extrait du mécanisme de Fallback Hybride Transparent
public async askAI(prompt: string, options: AIRequestOptions = {}): Promise<AIResponsePayload> {
  const provider = options.provider || this.defaultProvider; // 'gemini' | 'hybrid_mistral'

  if (provider === 'hybrid_mistral') {
    // 1. Tente d'abord la machine locale dédiée (Ollama / vLLM local)
    try {
      const localResult = await callLocalAI(prompt, options); // timeout 3500ms
      return {
        text: localResult.text,
        telemetry: { providerUsed: 'local_server', fallbackTriggered: false, sovereigntyLevel: 'local_strict' }
      };
    } catch (localError) {
      console.log("Panne locale détectée. Bascule transparente vers Mistral AI Cloud France...");
      
      // 2. Secours automatique et transparent vers Mistral AI Cloud France (Zéro erreur client)
      const cloudResult = await callMistralCloud(prompt, options);
      return {
        text: cloudResult.text,
        telemetry: { providerUsed: 'mistral_cloud_fallback', fallbackTriggered: true, sovereigntyLevel: 'european_cloud' }
      };
    }
  }
}`}</pre>
            </div>

          </div>
        )}

        {/* --- TAB 3: CLIENT LOCAL OLLAMA / VLLM (STREAMING, ABORT & OOM FALLBACK) --- */}
        {activeTab === 'local_client' && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6">
            
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-emerald-400" />
                  Client d'Inférence Locale Ollama / vLLM (<code>localLLMClient.ts</code>)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Connexion directe à <code>http://localhost:11434</code> via l'API fetch standard. Streaming temps réel par tokens, gestion d'annulation avec <code>AbortController</code>, et bascule transparente vers modèle allégé si saturation mémoire (OOM).
                </p>
              </div>

              {/* Ping health button */}
              <button
                onClick={handleCheckLocalHealth}
                disabled={isCheckingHealth}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                <Activity className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
                <span>{isCheckingHealth ? 'Sonde en cours...' : 'Tester présence Ollama (Ping)'}</span>
              </button>
            </div>

            {/* Health status banner */}
            {localHealth && (
              <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                localHealth.isOnline 
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200' 
                  : 'bg-amber-950/40 border-amber-500/30 text-amber-200'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${localHealth.isOnline ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                  <span>
                    <strong>{localHealth.isOnline ? 'Serveur Local Détecté' : 'Serveur Local Hors Ligne'} :</strong> {localHealth.endpoint} ({localHealth.protocol.toUpperCase()}) — Latence {localHealth.latencyMs} ms
                  </span>
                </div>
                {localHealth.availableModels.length > 0 && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    Modèles disponibles : {localHealth.availableModels.slice(0, 3).join(', ')}{localHealth.availableModels.length > 3 ? '...' : ''}
                  </span>
                )}
              </div>
            )}

            {/* Interactive Test Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Configuration Controls */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* Endpoint */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>URL Instance Locale (Ollama / vLLM)</span>
                    <span className="text-[10px] text-slate-500 font-mono">Défaut: :11434</span>
                  </label>
                  <input
                    type="text"
                    value={localEndpoint}
                    onChange={(e) => setLocalEndpoint(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                    placeholder="http://localhost:11434"
                  />
                </div>

                {/* Model & Fallback Model */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Modèle Principal</label>
                    <input
                      type="text"
                      value={localModel}
                      onChange={(e) => setLocalModel(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                      placeholder="llama3:8b"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Modèle Repli OOM</label>
                    <input
                      type="text"
                      value={localFallbackModel}
                      onChange={(e) => setLocalFallbackModel(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                      placeholder="llama3.2:1b"
                    />
                  </div>
                </div>

                {/* Prompt */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Prompt de Test</label>
                  <textarea
                    rows={3}
                    value={localPrompt}
                    onChange={(e) => setLocalPrompt(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 resize-none focus:border-emerald-500 focus:outline-none leading-relaxed"
                  />
                </div>

                {/* OOM Fallback Simulation Toggle */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-amber-900/40 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={localSimulateOOM}
                    onChange={(e) => setLocalSimulateOOM(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  <div className="text-xs">
                    <div className="font-semibold text-amber-300">
                      Simuler saturation VRAM (OOM) au 1er appel
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      Déclenche automatiquement l'interception de l'erreur mémoire et la bascule transparente sur le modèle allégé <code>{localFallbackModel}</code>.
                    </div>
                  </div>
                </label>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleStartLocalStream}
                    disabled={isLocalStreaming}
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isLocalStreaming ? 'Génération en cours...' : 'Lancer le Stream (fetch)'}</span>
                  </button>

                  <button
                    onClick={handleAbortLocalStream}
                    disabled={!isLocalStreaming}
                    className="py-2.5 px-4 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 disabled:opacity-40 text-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Interrompre via AbortController"
                  >
                    <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
                    <span>Annuler (Abort)</span>
                  </button>
                </div>

              </div>

              {/* Right Column: Live Stream Console */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col min-h-[380px]">
                
                {/* Console Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white font-mono">Sortie Flux ReadableStream</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {localStreamModelUsed && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-[11px] border border-slate-700">
                        Modèle: {localStreamModelUsed}
                      </span>
                    )}
                    {localFallbackEvent && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 font-mono text-[11px] border border-amber-500/40 flex items-center gap-1 animate-pulse">
                        <Zap className="w-3 h-3 text-amber-400" />
                        Bascule OOM active
                      </span>
                    )}
                    {localTokenCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 font-mono text-[11px] border border-emerald-500/40">
                        {localTokenCount} tokens
                      </span>
                    )}
                  </div>
                </div>

                {/* Fallback Banner Alert if triggered */}
                {localFallbackEvent && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Interception OOM & Bascule Automatique Réussie :</div>
                      <div className="text-[11px] text-amber-300/90 mt-0.5 leading-relaxed">
                        Le modèle <code>{localFallbackEvent.originalModel}</code> a saturé la mémoire. Le client a automatiquement réitéré l'inférence sur le modèle léger <code>{localFallbackEvent.fallbackModel}</code> sans perte pour l'utilisateur.
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {localError && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed font-mono">{localError}</div>
                  </div>
                )}

                {/* Stream Content */}
                <div className="flex-1 mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-xs sm:text-sm text-slate-200 whitespace-pre-wrap overflow-y-auto max-h-[300px] leading-relaxed">
                  {localStreamText ? (
                    <>
                      {localStreamText}
                      {isLocalStreaming && (
                        <span className="inline-block w-2 h-4 ml-1 bg-emerald-400 animate-pulse align-middle" />
                      )}
                    </>
                  ) : (
                    <div className="text-slate-500 italic flex items-center justify-center h-full min-h-[140px]">
                      {isLocalStreaming ? (
                        <span className="flex items-center gap-2 text-emerald-400 font-sans not-italic text-xs">
                          <RefreshCw className="w-4 h-4 animate-spin" /> Connexion au socket local et réception des premiers tokens...
                        </span>
                      ) : (
                        'Cliquez sur "Lancer le Stream" pour amorcer la réception token par token.'
                      )}
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* Code TypeScript de référence */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Exemple d'Intégration TypeScript Strict (`localLLMClient.ts`)
                </span>
                <button
                  onClick={() => handleCopy(`import { LocalLLMClient } from './services/localLLMClient';

const client = new LocalLLMClient({
  baseUrl: 'http://localhost:11434', // Ollama ou vLLM
  defaultModel: 'llama3:8b',
  defaultFallbackModel: 'llama3.2:1b',
});

const controller = new AbortController();

try {
  // Streaming temps réel avec gestion AbortController & fallback automatique OOM
  for await (const chunk of client.streamChat(
    [{ role: 'user', content: 'Génère un résumé de contrat en 3 points.' }],
    {
      signal: controller.signal,
      fallbackModel: 'llama3.2:1b',
      onMemoryFallback: (event) => {
        console.warn('OOM détecté sur', event.originalModel, '-> Bascule sur', event.fallbackModel);
      }
    }
  )) {
    process.stdout.write(chunk.token);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Stream annulé par l’utilisateur.');
  }
}`)}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-800"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier le snippet TS</span>
                </button>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
                <pre>{`// Utilisation type-safe avec streaming fetch, AbortController et repli OOM
import { LocalLLMClient } from './services/localLLMClient';

const client = new LocalLLMClient({
  baseUrl: 'http://localhost:11434',
  defaultModel: 'llama3:8b',
  defaultFallbackModel: 'llama3.2:1b'
});

const controller = new AbortController();

for await (const chunk of client.streamChat(messages, {
  signal: controller.signal,
  fallbackModel: 'llama3.2:1b',
  onMemoryFallback: (ev) => console.log('Bascule OOM:', ev.fallbackModel)
})) {
  console.log(chunk.token); // Rendu incrémental fluide
}`}</pre>
              </div>
            </div>

          </div>
        )}

        {/* --- TAB 4: GESTIONNAIRE DE FILE D'ATTENTE FIFO & MULTI-GPU (TaskQueue.ts) --- */}
        {activeTab === 'task_queue' && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6">
            
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ListOrdered className="w-5 h-5 text-emerald-400" />
                  Gestionnaire Asynchrone de File d'Attente FIFO & Multi-GPU (<code>TaskQueue.ts</code>)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Ordonnancement FIFO strict avec priorisation, routage intelligent vers <strong>GPU 0 (port 11434)</strong> et <strong>GPU 1 (port 11435)</strong>, et chronométrage précis de l'inférence en millisecondes.
                </p>
              </div>

              {/* Controls bar: Stratégie & purge */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                  <span className="text-slate-400">Stratégie:</span>
                  <select
                    value={queueSnapshot.strategy}
                    onChange={(e) => handleStrategyChange(e.target.value as LoadBalancingStrategy)}
                    className="bg-transparent text-emerald-400 font-semibold focus:outline-hidden cursor-pointer"
                  >
                    <option value="least-busy" className="bg-slate-900 text-slate-200">Least-Busy (GPU le moins chargé)</option>
                    <option value="round-robin" className="bg-slate-900 text-slate-200">Round-Robin (Alterné 0/1)</option>
                    <option value="gpu-0-preferred" className="bg-slate-900 text-slate-200">Affinité GPU 0 prioritaire</option>
                    <option value="gpu-1-preferred" className="bg-slate-900 text-slate-200">Affinité GPU 1 prioritaire</option>
                  </select>
                </div>

                <button
                  onClick={handleClearQueue}
                  disabled={queueSnapshot.queuedCount === 0}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-700/50 disabled:opacity-40 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vider la file</span>
                </button>
              </div>
            </div>

            {/* Grille des Workers GPU (GPU 0 & GPU 1) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {queueSnapshot.workers.map((worker) => {
                const isBusy = worker.status === 'busy';
                return (
                  <div
                    key={worker.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isBusy
                        ? 'bg-emerald-950/20 border-emerald-500/50 shadow-xs shadow-emerald-500/10'
                        : 'bg-slate-900/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg ${isBusy ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                          <HardDrive className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-2">
                            <span>{worker.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-400 border border-slate-700">
                              :{worker.port}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {worker.baseUrl}
                          </div>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isBusy 
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40 animate-pulse' 
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {isBusy ? '● En Inférence' : '○ En Attente (Idle)'}
                      </span>
                    </div>

                    {/* Worker metrics telemetry */}
                    <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-slate-800/80 text-[11px]">
                      <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/50">
                        <div className="text-slate-400 text-[10px]">Tâches Traitées</div>
                        <div className="text-white font-bold font-mono mt-0.5">{worker.metrics.totalTasksProcessed}</div>
                      </div>
                      <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/50">
                        <div className="text-slate-400 text-[10px]">Temps Moyen</div>
                        <div className="text-emerald-400 font-bold font-mono mt-0.5">
                          {worker.metrics.averageInferenceTimeMs > 0 ? `${worker.metrics.averageInferenceTimeMs} ms` : '—'}
                        </div>
                      </div>
                      <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/50">
                        <div className="text-slate-400 text-[10px]">Débit Déduit</div>
                        <div className="text-blue-400 font-bold font-mono mt-0.5">
                          {worker.metrics.averageTokensPerSec > 0 ? `${worker.metrics.averageTokensPerSec} tok/s` : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Formulaire d'injection de tâche dans la file FIFO */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  Soumettre un Prompt dans la File Asynchrone
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEnqueueBatch(4)}
                    disabled={isSubmittingBatch}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                  >
                    + Simuler Rafale (4 Tâches FIFO)
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <textarea
                  rows={2}
                  value={queuePrompt}
                  onChange={(e) => setQueuePrompt(e.target.value)}
                  placeholder="Écrivez un prompt à traiter par les GPU locaux..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 font-mono"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5 text-slate-400">
                      <span>Cible :</span>
                      <select
                        value={queuePreferredGpu}
                        onChange={(e) => setQueuePreferredGpu(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-hidden"
                      >
                        <option value="auto">Auto (Load Balancer)</option>
                        <option value="gpu-0">GPU 0 (:11434)</option>
                        <option value="gpu-1">GPU 1 (:11435)</option>
                      </select>
                    </label>

                    <label className="flex items-center gap-1.5 text-slate-400">
                      <span>Priorité :</span>
                      <select
                        value={queuePriority}
                        onChange={(e) => setQueuePriority(Number(e.target.value))}
                        className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-hidden"
                      >
                        <option value={0}>Normale (FIFO standard)</option>
                        <option value={1}>Haute (Passe en tête de file)</option>
                      </select>
                    </label>
                  </div>

                  <button
                    onClick={handleEnqueueSingle}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs shadow-emerald-900/30 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enfiler la requête (Enqueue)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* État de la file d'attente FIFO (en attente) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  File d'Attente FIFO Active ({queueSnapshot.queuedCount} requête{queueSnapshot.queuedCount > 1 ? 's' : ''} en attente)
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  Ordonnancement : Premier entré, premier servi
                </span>
              </div>

              {queueSnapshot.queuedTasks.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                  La file d'attente est vide. Toutes les requêtes ont été dépilées et traitées par les GPU.
                </div>
              ) : (
                <div className="space-y-2">
                  {queueSnapshot.queuedTasks.map((t, idx) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-slate-200 font-mono truncate text-[11px]">
                            {t.prompt}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>ID: {t.id}</span>
                            <span>•</span>
                            <span>En attente depuis : <strong>{t.waitDurationMs} ms</strong></span>
                            {t.priority > 0 && (
                              <span className="bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.2 rounded-sm text-[9px] font-bold">
                                Priorité Haute
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleCancelQueueTask(t.id)}
                        className="px-2 py-1 bg-slate-800 hover:bg-rose-900/50 hover:text-rose-200 text-slate-400 rounded-lg text-[11px] transition-colors shrink-0 cursor-pointer"
                        title="Annuler cette requête dans la file"
                      >
                        Annuler
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historique des requêtes traitées avec mesure du temps d'inférence en millisecondes */}
            {completedQueueTasks.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                    Chronométrage des Inférences Terminées (Mesure en ms)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    performance.now() natif
                  </span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {completedQueueTasks.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs font-mono"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] text-slate-300 truncate max-w-md">
                          « {item.prompt.slice(0, 70)}{item.prompt.length > 70 ? '...' : ''} »
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2 py-0.5 rounded-sm bg-slate-800 text-slate-300 text-[10px] font-bold border border-slate-700">
                            {item.gpuId.toUpperCase()}
                          </span>
                          <span className="px-2 py-0.5 rounded-sm bg-emerald-950 text-emerald-300 text-[10px] font-bold border border-emerald-800">
                            Inférence : {item.inferenceTimeMs} ms
                          </span>
                          <span className="px-2 py-0.5 rounded-sm bg-blue-950 text-blue-300 text-[10px] font-bold border border-blue-800">
                            Attente file : {item.queueWaitTimeMs} ms
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            {item.tokensPerSecond} tok/s
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800/40 line-clamp-2">
                        {item.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Extrait d'intégration pour les développeurs */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Exemple d'Utilisation TypeScript (<code>TaskQueue.ts</code>)</span>
                <span className="text-[10px] text-slate-500 font-mono">Multi-GPU FIFO</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                <pre>{`import { TaskQueue } from './services/TaskQueue';

// Instanciation du gestionnaire avec 2 endpoints GPU distincts
const queue = new TaskQueue({
  strategy: 'least-busy', // ou 'round-robin'
  workers: [
    { id: 'gpu-0', name: 'GPU 0', baseUrl: 'http://localhost:11434', port: 11434 },
    { id: 'gpu-1', name: 'GPU 1', baseUrl: 'http://localhost:11435', port: 11435 }
  ]
});

// Enfilement asynchrone avec retour immédiat du taskId et de la promesse
const { taskId, promise } = queue.enqueue('Analyse cadastrale LiDAR...', { priority: 1 });

const result = await promise;
console.log(\`Traité sur \${result.metrics.assignedGpuId} en \${result.metrics.inferenceTimeMs} ms\`);
console.log(\`Temps d'attente FIFO : \${result.metrics.queueWaitTimeMs} ms | Débit : \${result.metrics.tokensPerSecond} tok/s\`);`}</pre>
              </div>
            </div>

          </div>
        )}

        {/* --- TAB: GÉNÉRATEUR DE CONTINUITÉ VISUELLE (Wan2GP / MiniMax H3) --- */}
        {activeTab === 'video_continuity' && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Film className="w-5 h-5 text-emerald-400" />
                  Générateur de Prompts de Continuité Visuelle Vidéo (<code>visualContinuityPromptBuilder.ts</code>)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Verrouillage strict des traits du personnage, tenue vestimentaire immuable, optique cinématographique et ratios anti-dérive pour <strong>Wan2GP</strong>, <strong>MiniMax Hailuo H3</strong> et CogVideoX.
                </p>
              </div>

              <button
                onClick={handleCompileVideoPrompt}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs shadow-emerald-900/30 cursor-pointer shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Compiler le Prompt Vidéo</span>
              </button>
            </div>

            {/* Formulaire interactif personnage & scène */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3.5">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  1. Fiche Personnage Verrouillée (Identity Lock)
                </span>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Nom / Rôle</label>
                    <input
                      type="text"
                      value={charName}
                      onChange={(e) => setCharName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-hidden font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Âge & Allure</label>
                    <input
                      type="text"
                      value={charAge}
                      onChange={(e) => setCharAge(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Traits Visage & Anatomie Immuables</label>
                  <textarea
                    rows={2}
                    value={charTraits}
                    onChange={(e) => setCharTraits(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-hidden font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Tenue Verrouillée (IMMUTABLE WARDROBE)</label>
                  <textarea
                    rows={2}
                    value={charOutfit}
                    onChange={(e) => setCharOutfit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-emerald-300 focus:outline-hidden font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3.5">
                <span className="font-bold text-blue-400 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" />
                  2. Action, Cadrage & Paramètres Caméra
                </span>

                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Action du Plan (Motion Sequence)</label>
                  <textarea
                    rows={2}
                    value={shotAction}
                    onChange={(e) => setShotAction(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-hidden font-mono text-[11px]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Cadrage</label>
                    <select
                      value={shotFraming}
                      onChange={(e) => setShotFraming(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-300 focus:outline-hidden text-[11px]"
                    >
                      <option value="close_up">Gros Plan (Close-up)</option>
                      <option value="medium_close_up">Plan Poitrine (MCU)</option>
                      <option value="medium_shot">Plan Moyen (MS)</option>
                      <option value="cowboy_shot">Plan Américain</option>
                      <option value="full_body">Plan d'Ensemble</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Éclairage</label>
                    <select
                      value={shotLighting}
                      onChange={(e) => setShotLighting(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-300 focus:outline-hidden text-[11px]"
                    >
                      <option value="cinematic_soft_rembrandt">Rembrandt Doux</option>
                      <option value="dramatic_chiaroscuro">Clair-obscur</option>
                      <option value="golden_hour_warm">Golden Hour</option>
                      <option value="overcast_diffused">Lumière Diffuse</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Moteur Vidéo</label>
                    <select
                      value={shotModel}
                      onChange={(e) => setShotModel(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-emerald-400 font-semibold focus:outline-hidden text-[11px]"
                    >
                      <option value="wan2gp">Wan2.1 (Wan2GP)</option>
                      <option value="minimax_h3">MiniMax Hailuo H3</option>
                      <option value="cogvideox">CogVideoX-5B</option>
                    </select>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Verrouillage Ratio : <strong className="text-white">16:9</strong></span>
                  <span>Cadence : <strong className="text-white">24 fps</strong></span>
                  <span>Capteur : <strong className="text-white">ARRI Alexa Mini LF</strong></span>
                </div>
              </div>
            </div>

            {/* Résultat compilé */}
            {compiledVideoPrompt ? (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-900 border border-emerald-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Check className="w-4 h-4" />
                      Positive Prompt Compilé (Anglais Professionnel Haut Débit)
                    </span>
                    <button
                      onClick={() => handleCopy(compiledVideoPrompt.positivePrompt)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedCode ? 'Copié !' : 'Copier Prompt'}</span>
                    </button>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800/90 font-mono text-[11px] text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {compiledVideoPrompt.positivePrompt}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-rose-900/40 space-y-2">
                  <span className="text-xs font-bold text-rose-400">
                    Negative Prompt Anti-Dérive (Verrouillage Vestimentaire & Temporal Anti-Jitter)
                  </span>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-rose-300/90">
                    {compiledVideoPrompt.negativePrompt}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                Cliquez sur <strong>« Compiler le Prompt Vidéo »</strong> pour générer la directive complète avec verrouillage d'identité.
              </div>
            )}
          </div>
        )}

        {/* --- TAB: RAG 100% LOCAL (DEXIE + INDEXEDDB + COSINUS) --- */}
        {activeTab === 'local_rag' && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-400" />
                  Module RAG 100 % Local (IndexedDB Dexie.js + Vecteurs Légers)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Découpage sémantique Markdown, stockage local persistant sans aucun serveur externe, et recherche par similarité cosinus avec extraction des 3 sections les plus pertinentes.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleIndexRagDoc}
                  disabled={isIndexingRag}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isIndexingRag ? 'animate-spin' : ''}`} />
                  <span>{isIndexingRag ? 'Indexation en cours...' : '1. Chunker & Indexer dans Dexie'}</span>
                </button>
              </div>
            </div>

            {/* Document Markdown source */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    Document Markdown Source
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {ragIndexedCount > 0 ? `${ragIndexedCount} chunks en base IndexedDB` : 'Non indexé'}
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={ragMarkdown}
                  onChange={(e) => setRagMarkdown(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 font-mono text-[11px] focus:outline-hidden"
                />
              </div>

              {/* Barre de recherche sémantique */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-white flex items-center gap-1.5 mb-2">
                    <Search className="w-3.5 h-3.5 text-emerald-400" />
                    Requête de Recherche Sémantique Locale
                  </span>
                  <textarea
                    rows={3}
                    value={ragQuery}
                    onChange={(e) => setRagQuery(e.target.value)}
                    placeholder="Posez une question sur le document..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 font-mono text-[11px] focus:outline-hidden"
                  />
                </div>

                <button
                  onClick={handleSearchRag}
                  disabled={isSearchingRag}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center justify-center gap-2 border border-slate-700 transition-colors cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2. Calculer Similarité Cosinus (Top 3 Sections)</span>
                </button>
              </div>
            </div>

            {/* Top 3 sections les plus pertinentes */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                  Les 3 Sections les Plus Pertinentes (Classement par Similarité Cosinus)
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  IndexedDB: AlphabetteLocalRAG_DB
                </span>
              </div>

              {ragResults.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                  Cliquez sur <strong>« Chunker & Indexer dans Dexie »</strong> pour charger la base locale, puis lancez une recherche.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {ragResults.map((item) => (
                    <div
                      key={item.chunkId}
                      className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold font-mono flex items-center justify-center">
                            #{item.rank}
                          </span>
                          <span className="px-2 py-0.5 rounded-sm bg-emerald-950 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-800">
                            Score : {item.matchPercentage}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-white truncate">
                          {item.sectionHeader}
                        </div>
                        <p className="text-[11px] text-slate-300 mt-2 leading-relaxed font-sans line-clamp-5">
                          {item.content}
                        </p>
                      </div>

                      <div className="text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800">
                        Cosinus : {item.similarityScore}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB: EXPORTATEUR DE PROJET AUTONOME (CHIFFREMENT AES-GCM ZÉRO SERVEUR) --- */}
        {activeTab === 'project_export' && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileKey2 className="w-5 h-5 text-emerald-400" />
                  Exportateur de Projet Autonome Chiffré (<code>autonomousProjectExporter.ts</code>)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Compilation intégrale du projet (scénario, fiches techniques, liens fichiers locaux) chiffré côté client avec <strong>SubtleCrypto AES-GCM (256 bits)</strong> et dérivation PBKDF2 (100 000 itérations).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportProject}
                  disabled={isExporting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isExporting ? 'Chiffrement AES...' : 'Chiffrer le Projet'}</span>
                </button>
              </div>
            </div>

            {/* Saisie mot de passe de chiffrement */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  Mot de passe de Dérivation Cryptographique (PBKDF2)
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  AES-GCM 256 bits • Salt 16 octets • IV 12 octets
                </span>
              </div>

              <input
                type="text"
                value={exportPassphrase}
                onChange={(e) => setExportPassphrase(e.target.value)}
                placeholder="Entrez un mot de passe fort..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 font-mono text-xs focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            {/* Affichage d'erreur cryptographique */}
            {cryptoError && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{cryptoError}</span>
              </div>
            )}

            {/* Résultat du conteneur chiffré */}
            {exportPackageResult && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900 border border-emerald-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Fichier Package Chiffré Prêt (Manifeste Public)
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Projet: <strong>{exportPackageResult.manifest.projectName}</strong> • {exportPackageResult.manifest.sceneCount} scènes • {exportPackageResult.manifest.fileLinksCount} liens fichiers locaux
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDownloadEncryptedFile}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Télécharger .alphabette.json</span>
                      </button>

                      <button
                        onClick={handleTestDecryptProject}
                        disabled={isImporting}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                      >
                        <span>Tester Déchiffrement & Schéma</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs pt-2">
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 font-mono text-[10px]">
                      <div className="text-slate-400">Sel Cryptographique</div>
                      <div className="text-slate-300 truncate mt-0.5">{exportPackageResult.saltBase64.slice(0, 16)}...</div>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 font-mono text-[10px]">
                      <div className="text-slate-400">Vecteur d'Init (IV)</div>
                      <div className="text-slate-300 truncate mt-0.5">{exportPackageResult.ivBase64}</div>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 font-mono text-[10px]">
                      <div className="text-slate-400">Ciphertext AES-GCM</div>
                      <div className="text-emerald-400 truncate mt-0.5">{exportPackageResult.ciphertextBase64.slice(0, 24)}...</div>
                    </div>
                  </div>
                </div>

                {/* Aperçu du projet déchiffré avec validation de schéma */}
                {decryptedProjectPreview && (
                  <div className="p-4 rounded-xl bg-slate-900 border border-blue-900/50 space-y-2">
                    <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      Validation de Schéma Réussie & Données Déchiffrées
                    </span>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-200 max-h-48 overflow-y-auto">
                      <pre>{JSON.stringify(decryptedProjectPreview, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- TAB: VARIABLES D'ENVIRONNEMENT --- */}
        {activeTab === 'env' && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                Configuration des Variables d'Environnement (.env)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Toutes les clés et URLs sont stockées strictement côté serveur et documentées dans <code>.env.example</code>.
              </p>
            </div>

            <div className="space-y-4">
              
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-xs font-bold text-blue-400">GEMINI_API_KEY</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Clé Google AI Studio pour la Phase 1 (fournie et injectée automatiquement dans le studio).
                  </div>
                </div>
                <span className="text-[10px] bg-blue-950 text-blue-300 px-2.5 py-1 rounded-full font-bold border border-blue-800 shrink-0">
                  Injectée par Google AI Studio
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-xs font-bold text-emerald-400">AI_PROVIDER</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Fournisseur par défaut : <code>gemini</code> (Phase 1 active) ou <code>hybrid_mistral</code> (Cible Phase 2 & 3).
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2.5 py-1 rounded-full font-bold border border-emerald-800 shrink-0">
                  Valeur: "gemini" | "hybrid_mistral"
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-xs font-bold text-slate-300">LOCAL_AI_URL</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    URL d'inférence de la machine locale haute performance ALPHABETTE (ex: <code>http://localhost:11434</code>).
                  </div>
                </div>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full font-bold shrink-0">
                  Défaut: http://localhost:11434
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-xs font-bold text-purple-400">MISTRAL_API_KEY</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Clé API officielle Mistral AI pour le secours souverain européen (Phase 3).
                  </div>
                </div>
                <span className="text-[10px] bg-purple-950 text-purple-300 px-2.5 py-1 rounded-full font-bold border border-purple-800 shrink-0">
                  Secrets Panel / Production
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-xs font-bold text-amber-400">LOCAL_AI_TIMEOUT_MS</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Délai d'attente max avant bascule automatique sur Mistral Cloud (recommandé: <code>3500</code> ms).
                  </div>
                </div>
                <span className="text-[10px] bg-amber-950 text-amber-300 px-2.5 py-1 rounded-full font-bold border border-amber-800 shrink-0">
                  3500 ms (3.5s)
                </span>
              </div>

            </div>

          </div>
        )}

        </>
        )}

      </div>
    </section>
  );
};
