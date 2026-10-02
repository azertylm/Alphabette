import React, { useState, useEffect } from 'react';
import { 
  Check, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  Zap, 
  HeartHandshake,
  Info,
  Lock,
  Building2,
  CreditCard,
  Key,
  Flame,
  Clock,
  Gift,
  ExternalLink,
  Tag,
  Sliders,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AppItem, PlanType, UserProfile, HubCommercialConfig } from '../types';
import { getHubCommercialConfig, updateHubCommercialConfig } from '../services/aiService';

interface PricingSectionProps {
  user: UserProfile;
  apps: AppItem[];
  onSelectPlan: (plan: PlanType, unlockedAppIds?: string[]) => void;
  onOpenVipModal?: (tab?: 'activate' | 'generator') => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({
  user,
  apps,
  onSelectPlan,
  onOpenVipModal
}) => {
  // Config commerciale synchronisée depuis le serveur (/api/config.json)
  const [config, setConfig] = useState<HubCommercialConfig | null>(null);
  const [selectedUnitAppId, setSelectedUnitAppId] = useState<string>(
    user.unlockedAppIds.length > 0 ? user.unlockedAppIds[0] : 'france-service'
  );
  const [isAdminPricingOpen, setIsAdminPricingOpen] = useState(false);
  const [adminDiscount, setAdminDiscount] = useState<number>(15);
  const [adminBadgeText, setAdminBadgeText] = useState<string>("Offre Lancement Écosystème");
  const [adminPromoActive, setAdminPromoActive] = useState<boolean>(true);
  const [adminSingleByok, setAdminSingleByok] = useState<number>(39);
  const [adminSingleManaged, setAdminSingleManaged] = useState<number>(59);
  const [adminBouquetByok, setAdminBouquetByok] = useState<number>(99);
  const [adminBouquetManaged, setAdminBouquetManaged] = useState<number>(199);
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
  const [adminSuccessMsg, setAdminSuccessMsg] = useState<string | null>(null);

  // Charger la configuration commerciale officielle
  useEffect(() => {
    getHubCommercialConfig()
      .then((cfg) => {
        setConfig(cfg);
        if (cfg.pricing) {
          setAdminSingleByok(cfg.pricing.singleApp.byok);
          setAdminSingleManaged(cfg.pricing.singleApp.managed);
          setAdminBouquetByok(cfg.pricing.bouquet.byok);
          setAdminBouquetManaged(cfg.pricing.bouquet.managed);
        }
        if (cfg.activePromotion) {
          setAdminDiscount(cfg.activePromotion.discountPercent);
          setAdminBadgeText(cfg.activePromotion.badgeLabel);
          setAdminPromoActive(cfg.activePromotion.isActive);
        }
      })
      .catch((err) => console.warn("Erreur chargement config commerciale:", err));
  }, []);

  const handleSavePromo = async () => {
    setIsUpdatingConfig(true);
    try {
      const updated = await updateHubCommercialConfig({
        pricing: {
          singleApp: {
            byok: Number(adminSingleByok),
            managed: Number(adminSingleManaged),
          },
          bouquet: {
            byok: Number(adminBouquetByok),
            managed: Number(adminBouquetManaged),
          },
        },
        activePromotion: {
          isActive: adminPromoActive,
          badgeLabel: adminBadgeText,
          discountPercent: Number(adminDiscount),
          expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
          description: `-${adminDiscount}% immédiats sur le Pass Bouquet Intégral avec le code SOUVERAIN${adminDiscount}`,
          couponCode: `SOUVERAIN${adminDiscount}`,
        }
      });
      setConfig(updated);
      setAdminSuccessMsg("Configuration commerciale et tarifs mis à jour instantanément pour les 15 applications !");
      setTimeout(() => setAdminSuccessMsg(null), 3500);
    } catch (e) {
      alert("Erreur lors de la mise à jour de la configuration.");
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  const discountPercent = config?.activePromotion?.isActive ? config.activePromotion.discountPercent : 0;
  const bouquetIntegralOriginal = config?.pricing.bouquet.managed ?? 199;
  const bouquetIntegralDiscounted = discountPercent > 0 
    ? Math.round(bouquetIntegralOriginal * (1 - discountPercent / 100)) 
    : bouquetIntegralOriginal;

  return (
    <section id="tarifs" className="py-12 sm:py-16 bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Bandeau promotionnel actif piloté par /api/config.json */}
        {config?.activePromotion?.isActive && (
          <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white shadow-lg border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <span className="text-xs uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                    {config.activePromotion.badgeLabel}
                  </span>
                  <span className="text-xs text-emerald-300 font-mono">
                    Code : <strong>{config.activePromotion.couponCode}</strong>
                  </span>
                </div>
                <p className="text-sm font-bold text-white mt-0.5">
                  {config.activePromotion.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onSelectPlan('bouquet_integral')}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-transform hover:scale-102 cursor-pointer flex items-center gap-1.5"
              >
                <span>Activer l'offre ({bouquetIntegralDiscounted} € / an)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>Grille Tarifaire Officielle · Abonnements Annuels Sans Engagement</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Tarifs clairs, souverains et propulsés par Mistral AI
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-700 leading-relaxed">
            Chaque application de la suite fonctionne en totale conformité RGPD, hébergée en France/Europe.
            Bénéficiez de <strong className="text-slate-900 font-bold">7 jours d'essai offerts</strong> pour toute nouvelle inscription, puis choisissez entre votre propre clé (BYOK) ou la formule managée clé en main.
          </p>
        </div>

        {/* GRILLE TARIFAIRE OFFICIELLE EN 2 BLOCS : APPLICATION INDIVIDUELLE & LE BOUQUET ALPHABETTE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch mb-10">
          
          {/* =========================================================================
              BLOC 1 : APPLICATION INDIVIDUELLE (39 € BYOK ou 59 € Confort)
             ========================================================================= */}
          <div className="bg-slate-50 rounded-3xl border border-slate-200 p-6 sm:p-8 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-900 bg-blue-100 px-3 py-1 rounded-full">
                  Application Individuelle
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Au choix parmi les 15 briques
                </span>
              </div>

              <h3 className="text-2xl font-black text-slate-900">
                1 Application au Choix
              </h3>
              <p className="text-xs text-slate-600 mt-1 min-h-[32px] leading-relaxed">
                Accédez à l'application métier de votre choix (ex: Service France, LIDARSOL, IADébat, etc.) en gérant votre clé ou clé en main.
              </p>

              {/* Sélecteur d'application */}
              <div className="my-4 p-3 bg-white rounded-xl border border-slate-200">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Sélectionnez votre application métier :
                </label>
                <select
                  value={selectedUnitAppId}
                  onChange={(e) => setSelectedUnitAppId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-blue-500"
                >
                  {apps.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {a.tagline}
                    </option>
                  ))}
                </select>
              </div>

              {/* Les 2 Formules de l'Application Individuelle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5">
                
                {/* Formule BYOK : 39 € / an */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  user.subscriptionPlan === 'single_byok'
                    ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-extrabold text-blue-950">Formule BYOK</span>
                    <Key className="w-3.5 h-3.5 text-blue-700" />
                  </div>
                  <div className="flex items-baseline gap-1 my-2">
                    <span className="text-3xl font-extrabold text-blue-900">39 €</span>
                    <span className="text-xs font-semibold text-slate-600">/ an</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Accès illimité aux fonctionnalités de l'application, l'utilisateur gère sa propre clé API Mistral.
                  </p>
                  <button
                    onClick={() => onSelectPlan('single_byok', [selectedUnitAppId])}
                    className="mt-4 w-full py-2 px-3 rounded-lg text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white transition-colors cursor-pointer"
                  >
                    Choisir à 39 € / an
                  </button>
                </div>

                {/* Formule Confort : 59 € / an */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  user.subscriptionPlan === 'single_managed'
                    ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-extrabold text-blue-950">Formule Confort</span>
                    <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                  </div>
                  <div className="flex items-baseline gap-1 my-2">
                    <span className="text-3xl font-extrabold text-blue-900">59 €</span>
                    <span className="text-xs font-semibold text-slate-600">/ an</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Accès complet clé en main, consommation d'IA Mistral managée par nos soins (après les 7 jours d'essai).
                  </p>
                  <button
                    onClick={() => onSelectPlan('single_managed', [selectedUnitAppId])}
                    className="mt-4 w-full py-2 px-3 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
                  >
                    Choisir à 59 € / an
                  </button>
                </div>

              </div>

              {/* Cross-selling callout obligatoire vers le Bouquet */}
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <strong>Opportunité économique majeure :</strong> Pour seulement 99 € / an (BYOK) ou 199 € / an (Intégral), débloquez <strong>TOUTES les 15 applications</strong> de l'écosystème avec le Bouquet complet !
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Paiement annuel sécurisé Stripe</span>
              <span>100% Souverain Mistral AI</span>
            </div>
          </div>


          {/* =========================================================================
              BLOC 2 : LE BOUQUET ALPHABETTE (99 € BYOK ou 199 € Intégral - RECOMMANDÉ)
             ========================================================================= */}
          <div className="relative bg-slate-900 text-white rounded-3xl border-2 border-emerald-500 p-6 sm:p-8 flex flex-col justify-between shadow-xl shadow-slate-900/10">
            {/* Top Recommended Tag */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 font-black text-xs px-4 py-1 rounded-full uppercase tracking-wider shadow-md">
              Formule Recommandée · Accès Intégral 15 Apps
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-4 mt-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-950 px-3 py-1 rounded-full border border-emerald-800">
                  Le Bouquet Alphabette
                </span>
                <span className="text-xs text-emerald-300 font-bold">
                  Accès à TOUTES les applications
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Suite Logicielle Complète (15 Apps)
              </h3>
              <p className="text-xs text-slate-300 mt-1 min-h-[32px] leading-relaxed">
                Une tour de contrôle unifiée pour votre foyer ou votre entreprise. Synergie native des données et compte SSO centralisé.
              </p>

              {/* Les 2 Formules du Bouquet Alphabette */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5">
                
                {/* Pass Bouquet BYOK : 99 € / an */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  user.subscriptionPlan === 'bouquet_byok'
                    ? 'bg-emerald-950/60 border-emerald-400 ring-2 ring-emerald-500/20'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-extrabold text-emerald-400">Pass Bouquet BYOK</span>
                    <Key className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-1 my-2">
                    <span className="text-3xl font-extrabold text-white">99 €</span>
                    <span className="text-xs font-semibold text-slate-400">/ an</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Accès illimité à l'intégralité de la suite logicielle Alphabette avec sa propre clé API Mistral.
                  </p>
                  <button
                    onClick={() => onSelectPlan('bouquet_byok')}
                    className="mt-4 w-full py-2.5 px-3 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer border border-slate-700"
                  >
                    Choisir BYOK (99 € / an)
                  </button>
                </div>

                {/* Pass Bouquet Intégral : 199 € / an (ou prix remisé si promo active) */}
                <div className={`relative p-4 rounded-2xl border transition-all ${
                  user.subscriptionPlan === 'bouquet_integral' || user.subscriptionPlan === 'alphabette_pass'
                    ? 'bg-emerald-950 border-emerald-400 ring-2 ring-emerald-500/40 shadow-md'
                    : 'bg-emerald-950/30 border-emerald-500/50 hover:border-emerald-400'
                }`}>
                  {discountPercent > 0 && (
                    <span className="absolute -top-2.5 right-3 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-xs">
                      -{discountPercent}% Promo
                    </span>
                  )}
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-extrabold text-emerald-300">Bouquet Intégral</span>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-1.5 my-2">
                    <span className="text-3xl font-black text-emerald-400">{bouquetIntegralDiscounted} €</span>
                    {discountPercent > 0 && (
                      <span className="text-xs line-through text-slate-500">{bouquetIntegralOriginal} €</span>
                    )}
                    <span className="text-xs font-semibold text-slate-300">/ an</span>
                  </div>
                  <p className="text-[11px] text-slate-200 leading-snug">
                    Accès illimité à l'intégralité de la suite logicielle avec les clés d'API Mistral gérées et incluses.
                  </p>
                  <button
                    onClick={() => onSelectPlan('bouquet_integral')}
                    className="mt-4 w-full py-2.5 px-3 rounded-lg text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <span>Prendre l'Intégral ({bouquetIntegralDiscounted} € / an)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>

              {/* Avantages du Bouquet */}
              <ul className="space-y-2 text-xs text-slate-300 my-4">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Les 15 applications métiers débloquées simultanément</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Suite Service France 7 modules Zero-Knowledge incluse</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>SSO centralisé sans re-saisie d'identifiants</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Support prioritaire et sauvegardes chiffrées locales</span>
                </li>
              </ul>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Économie de plus de 65% par rapport à l'unité</span>
              <span className="text-emerald-400 font-semibold">Hub http://alphabette.fr</span>
            </div>
          </div>

        </div>

        {/* Espace Code Privilège VIP / Ami & Bouton d'Administration Commerciale */}
        <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-900">
                  Accès Invité & Partenaire
                </span>
                <span className="text-[10px] bg-purple-200 text-purple-900 px-2 py-0.2 rounded-full font-bold">
                  Usage Unique Sécurisé
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-base mt-0.5">
                Vous disposez d'un Code Privilège / VIP offert ?
              </h4>
              <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                Activez votre code d'accès unique (ex. <code>VIP-X89K2</code>) pour débloquer immédiatement 1 an d'accès gratuit au Bouquet complet sans carte bancaire.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={() => onOpenVipModal?.('activate')}
              className="px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Activer mon Code Privilège</span>
            </button>

            <button
              onClick={() => setIsAdminPricingOpen(!isAdminPricingOpen)}
              className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
              title="Panneau de commande des promotions et de l'API /api/config.json"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{isAdminPricingOpen ? 'Masquer Admin Promo' : 'Admin Hub Promo'}</span>
            </button>
          </div>
        </div>

        {/* Panneau d'administration en direct des promotions (/api/admin/config) */}
        {isAdminPricingOpen && (
          <div className="mt-4 p-5 rounded-2xl bg-slate-900 text-white border border-slate-800 text-xs space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-sm text-white">
                  Tour de Contrôle Commerciale — Pilotage Centralisé (<code>/api/config.json</code>)
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Consommé en temps réel par les 15 applications
              </span>
            </div>

            {adminSuccessMsg && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{adminSuccessMsg}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <span className="font-bold text-slate-300 block mb-2">1. Tarifs Officiels Annuels de Base (€ / an) :</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">App BYOK</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={adminSingleByok}
                        onChange={(e) => setAdminSingleByok(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                      />
                      <span className="absolute right-2 top-2 text-slate-500">€/an</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">App Confort (Mistral)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={adminSingleManaged}
                        onChange={(e) => setAdminSingleManaged(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                      />
                      <span className="absolute right-2 top-2 text-slate-500">€/an</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Pass Bouquet BYOK</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={adminBouquetByok}
                        onChange={(e) => setAdminBouquetByok(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                      />
                      <span className="absolute right-2 top-2 text-slate-500">€/an</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Bouquet Intégral</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={adminBouquetManaged}
                        onChange={(e) => setAdminBouquetManaged(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono font-bold text-emerald-400"
                      />
                      <span className="absolute right-2 top-2 text-slate-500">€/an</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-300 block mb-2">2. Pilotage des Promotions Actives :</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-slate-400 block mb-1">Statut de la promotion</label>
                    <button
                      type="button"
                      onClick={() => setAdminPromoActive(!adminPromoActive)}
                      className={`w-full py-2 px-3 rounded-lg font-bold transition-colors cursor-pointer text-center ${
                        adminPromoActive ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {adminPromoActive ? '● Promotion Active' : '○ Promotion Désactivée'}
                    </button>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Libellé du bandeau</label>
                    <input
                      type="text"
                      value={adminBadgeText}
                      onChange={(e) => setAdminBadgeText(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Réduction en pourcentage (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={adminDiscount}
                      onChange={(e) => setAdminDiscount(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-[11px]">
                  Endpoint exposé : <code>GET http://alphabette.fr/api/config.json</code>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenVipModal?.('generator')}
                  className="px-3 py-1.5 bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/40 rounded-lg font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer"
                >
                  <Gift className="w-3.5 h-3.5 text-purple-400" />
                  <span>Générateur de Codes VIP Amis</span>
                </button>
              </div>

              <button
                onClick={handleSavePromo}
                disabled={isUpdatingConfig}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl cursor-pointer disabled:opacity-50"
              >
                {isUpdatingConfig ? 'Diffusion en cours...' : 'Diffuser la mise à jour aux 15 applications'}
              </button>
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
