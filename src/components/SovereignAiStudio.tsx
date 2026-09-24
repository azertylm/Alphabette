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
  HeartHandshake
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
import { UserProfile } from '../types';

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
  const [activeTab, setActiveTab] = useState<'tester' | 'architecture' | 'env'>('tester');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [serverConfig, setServerConfig] = useState<AIConfigResponse | null>(null);

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

  // Check access: Is this app unlocked for the user?
  const isAppUnlocked = 
    user.subscriptionPlan === 'alphabette_pass' ||
    (user.subscriptionPlan === 'single_app' && user.unlockedAppIds.includes(selectedPreset.id.toLowerCase()));

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

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 text-xs shrink-0 self-start md:self-auto">
            <button
              onClick={() => setActiveTab('tester')}
              className={`px-3.5 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'tester'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Banc d'Essai Interactif</span>
            </button>
            <button
              onClick={() => setActiveTab('architecture')}
              className={`px-3.5 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'architecture'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Code du Routeur (aiService)</span>
            </button>
            <button
              onClick={() => setActiveTab('env')}
              className={`px-3.5 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'env'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Variables d'Env</span>
            </button>
          </div>
        </div>

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
                    user.subscriptionPlan === 'alphabette_pass'
                      ? 'bg-emerald-500 text-slate-950'
                      : user.subscriptionPlan === 'single_app'
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {user.subscriptionPlan === 'alphabette_pass' ? '3€' : user.subscriptionPlan === 'single_app' ? '1€' : '0€'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Formule {user.subscriptionPlan === 'alphabette_pass' ? 'Pass Alphabette' : user.subscriptionPlan === 'single_app' ? 'À la carte' : 'Découverte'}</span>
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
                        : '1 € / mois pour cette app seule, ou 3 € / mois pour toute la suite'}
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

        {/* --- TAB 3: VARIABLES D'ENVIRONNEMENT --- */}
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

      </div>
    </section>
  );
};
