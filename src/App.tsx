import React, { useState, useEffect, useMemo } from 'react';
import { AppShell, type AlphaAppConfig } from '@alphabette/shell';
import '@alphabette/shell/style.css';
import { Accueil } from './components/Accueil';
import { BasAccueil } from './components/BasAccueil';
import { AppGrid } from './components/AppGrid';
import { PricingSection } from './components/PricingSection';
import { SovereignAiStudio } from './components/SovereignAiStudio';
import { CommitmentsSection } from './components/CommitmentsSection';
import { Footer } from './components/Footer';
import { UrlManagerModal } from './components/UrlManagerModal';
import { DatabaseArchitectureModal } from './components/DatabaseArchitectureModal';
import { AppLaunchModal } from './components/AppLaunchModal';
import { VipCodeModal } from './components/VipCodeModal';
import { VipActivationSection } from './components/VipActivationSection';
import { INITIAL_APPS, RETIRED_APP_IDS } from './data/initialApps';
import { fetchPublicApps } from './services/registryService';

/**
 * Vitrine publique : seul le registre central (applications réellement en ligne)
 * est présenté. L'ancien catalogue de démonstration et les outils de gestion
 * (URLs, architecture) restent accessibles en ajoutant ?admin à l'adresse.
 */
const MODE_ADMIN = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('admin');

/** Profil d'un visiteur anonyme : aucune offre souscrite, essai disponible. */
const PROFIL_VISITEUR = (): UserProfile => ({
  id: 'visiteur',
  name: 'Invité',
  email: '',
  role: 'citizen_member',
  tenantId: 'public',
  tenantName: 'Visiteur',
  subscriptionPlan: 'trial_7d',
  unlockedAppIds: [],
  ssoSessionId: '',
  memberSince: String(new Date().getFullYear()),
  trialDaysLeft: 7,
  trialExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
});

/** Profil de démonstration de la direction (mode administration uniquement). */
const PROFIL_DIRECTION = (): UserProfile => ({
      id: 'usr_alphabette_admin_01',
      name: 'Direction ALPHABETTE',
      email: 'direction@alphabette.fr',
      role: 'superadmin',
      tenantId: 'tnt_alphabette_france',
      tenantName: 'ALPHABETTE Hub Central',
      subscriptionPlan: 'ecosystem', // Par défaut : l'écosystème complet débloqué
      unlockedAppIds: INITIAL_APPS.map(a => a.id),
      ssoSessionId: 'sso_live_89f3a1c2',
      memberSince: '2024',
      city: 'La Grande-Motte',
      trialDaysLeft: 7,
      trialExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    });
import { AppItem, UserProfile, PlanType } from './types';
import { isAppPlan, isEcosystemPlan, isTrialPlan, planToast } from './plans';
import { Sparkles, CheckCircle2 } from 'lucide-react';

/** Le hub porte lui aussi la double barre de l'écosystème (avec le bouton BIG). */
const HUB_APP: AlphaAppConfig = {
  key: 'alphabette',
  name: 'Alphabette',
  tagline: 'Des applis qui simplifient la vie',
  accent: '#0f766e',
};

const STORAGE_KEY_APPS = 'alphabette_apps_v4';
const STORAGE_KEY_USER = 'alphabette_user_v4';

export default function App() {
  // 1. Applications state with localStorage persistence
  const [apps, setApps] = useState<AppItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_APPS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 15) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Erreur de lecture du cache local', e);
    }
    return INITIAL_APPS;
  });

  /**
   * Applications réellement montrées au public.
   * Le filtre est appliqué à l'affichage (et non dans les données) car le cache
   * local des visiteurs peut encore contenir les anciennes applications retirées.
   */
  const visibleApps = useMemo(
    () => apps.filter((app) => !RETIRED_APP_IDS.includes(app.id)),
    [apps],
  );

  // 2. User Profile state with SSO session, 7-day trial and Mistral AI access
  const [user, setUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      if (saved) {
        const profil = JSON.parse(saved);
        // Les anciennes versions enregistraient le profil « Direction » chez tous
        // les visiteurs : hors mode administration, on repart d'un visiteur.
        if (MODE_ADMIN || profil?.id !== 'usr_alphabette_admin_01') return profil;
      }
    } catch (e) {
      console.warn('Erreur de lecture du profil utilisateur', e);
    }
    return MODE_ADMIN ? PROFIL_DIRECTION() : PROFIL_VISITEUR();
  });

  // 3. Modal visibility states
  const [isUrlManagerOpen, setIsUrlManagerOpen] = useState(false);
  const [isDbArchitectureOpen, setIsDbArchitectureOpen] = useState(false);
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);
  const [vipModalTab, setVipModalTab] = useState<'activate' | 'generator'>('activate');
  const [launchingApp, setLaunchingApp] = useState<AppItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleOpenVipModal = (tab: 'activate' | 'generator' = 'activate') => {
    setVipModalTab(tab);
    setIsVipModalOpen(true);
  };

  // Sync apps to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_APPS, JSON.stringify(apps));
    } catch (e) {
      console.error('Erreur de sauvegarde locale', e);
    }
  }, [apps]);

  // Sync user to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } catch (e) {
      console.error('Erreur de sauvegarde profil', e);
    }
  }, [user]);

  // Toast notification helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handler: Change User Subscription Plan
  const handleChangePlan = (plan: PlanType, unlockedAppIds?: string[]) => {
    setUser(prev => ({
      ...prev,
      subscriptionPlan: plan,
      unlockedAppIds: unlockedAppIds !== undefined
        ? unlockedAppIds
        : (isEcosystemPlan(plan) || isTrialPlan(plan)
            ? apps.map(a => a.id)
            : (isAppPlan(plan) ? ['france-service'] : []))
    }));

    showToast(planToast(plan));
  };

  // Handler: Save Apps from URL Manager
  const handleSaveApps = (updatedApps: AppItem[]) => {
    setApps(updatedApps);
    showToast('Liens et applications mis à jour avec succès !');
  };

  // Handler: Reset to initial apps
  const handleResetDefaultApps = () => {
    if (confirm('Voulez-vous réinitialiser le catalogue officiel des 15 applications ALPHABETTE ?')) {
      setApps(INITIAL_APPS);
      showToast('Le catalogue officiel ALPHABETTE (15 applications) a été rétabli.');
    }
  };

  // Handler: Add new app slot trigger
  const handleAddNewAppSlot = () => {
    setIsUrlManagerOpen(true);
  };

  // Scroll to Pricing section
  const handleScrollToPricing = () => {
    const el = document.getElementById('tarifs');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Handler: VIP code successfully activated
  const handleCodeSuccessfullyActivated = (plan: PlanType, durationMonths: number, note?: string) => {
    setUser(prev => ({
      ...prev,
      subscriptionPlan: plan,
      unlockedAppIds: apps.map(a => a.id),
      vipGrantedUntil: new Date(Date.now() + durationMonths * 30 * 24 * 3600 * 1000).toISOString(),
    }));
    showToast(`🎉 Code VIP validé ! Écosystème complet offert pour ${durationMonths} mois (${note || 'Invité Privilège'}).`);
  };

  const configuredCount = apps.filter(a => a.isConfigured).length;

  // Nombre d'applications réellement en ligne (registre central).
  const [nbEnLigne, setNbEnLigne] = useState<number | null>(null);
  const [nbGratuites, setNbGratuites] = useState(0);
  // Applications payantes réellement en ligne, proposées à l'achat « une application ».
  const [appsAchetables, setAppsAchetables] = useState<AppItem[] | null>(null);
  useEffect(() => {
    fetchPublicApps()
      .then((liste) => {
        setNbEnLigne(liste.length);
        setNbGratuites(liste.filter((app) => app.gratuit).length);
        setAppsAchetables(
          liste
            .filter((app) => !app.gratuit)
            .map((app) => ({ id: app.slug, name: app.name, tagline: app.description ?? '' }) as AppItem),
        );
      })
      .catch(() => setNbEnLigne(null));
  }, []);
  const nbApps = nbEnLigne ?? visibleApps.length;
  const ouvrirUrls = MODE_ADMIN ? () => setIsUrlManagerOpen(true) : undefined;
  const ouvrirArchitecture = MODE_ADMIN ? () => setIsDbArchitectureOpen(true) : undefined;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-emerald-500 selection:text-white">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-3 animate-fade-in text-xs sm:text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Double barre de l'écosystème (DON, BIG, Jour/Nuit) + accueil « Kiosque clair » */}
      <AppShell app={HUB_APP}>
      <main className="flex-1">

        {/* 2. Phrase d'accroche, recherche et tuiles des applications (registre central) */}
        <Accueil appsCount={nbApps} />

        {/* 3. Tarifs, engagements, soutien et pied de page : courts, sans rien de simulé */}
        <BasAccueil gratuites={nbGratuites} />

        {/* Anciennes sections de démonstration (atelier IA, tarifs simulés, codes VIP) :
            réservées à l'administration (?admin), absentes de la vitrine publique. */}
        {MODE_ADMIN && (
        <div className="sections-claires">
        {/* 3 bis. Ancien catalogue de démonstration : réservé à l'administration (?admin) */}
        {MODE_ADMIN && <AppGrid
          apps={visibleApps}
          user={user}
          onLaunch={(app) => setLaunchingApp(app)}
          onEditUrl={() => setIsUrlManagerOpen(true)}
          onSelectSubscribe={() => handleScrollToPricing()}
          onAddNewAppSlot={handleAddNewAppSlot}
          onOpenUrlManager={() => setIsUrlManagerOpen(true)}
        />}

        {/* 4. Atelier Moteur IA Souverain (Mistral Cloud France / Local Metal Ollama) */}
        <SovereignAiStudio
          user={user}
          onOpenPricing={handleScrollToPricing}
        />

        {/* 5. Interactive Pricing Table : 15 € (une application) · 40 € (écosystème) avec API promo & activation VIP */}
        <PricingSection
          key={appsAchetables ? 'registre' : 'local'}
          user={user}
          apps={MODE_ADMIN || !appsAchetables?.length ? visibleApps : appsAchetables}
          onSelectPlan={handleChangePlan}
          onOpenVipModal={(tab) => handleOpenVipModal(tab || 'activate')}
        />

        {/* 6. Espace d'Activation de Code Privilège (Option 1 : Usage unique strict & anti-fuite) */}
        <VipActivationSection
          user={user}
          onCodeSuccessfullyActivated={handleCodeSuccessfullyActivated}
          onOpenAdminGenerator={() => handleOpenVipModal('generator')}
        />

        {/* 7. Commitments Section: Souveraineté Mistral AI, RGPD France, Zéro Entraînement Public */}
        <CommitmentsSection />

        </div>
        )}
      </main>

      {MODE_ADMIN && (
      <>
      {/* 8. Footer avec lien obligatoire vers https://alphabette.fr */}
      <div className="sections-claires">
      <Footer
        onOpenPricing={handleScrollToPricing}
        onOpenUrlManager={ouvrirUrls}
        onOpenDbArchitecture={ouvrirArchitecture}
        appsCount={nbApps}
      />
      </div>
      </>
      )}
      </AppShell>

      {/* Modals */}
      {/* URL / Links Manager Modal */}
      <UrlManagerModal
        isOpen={isUrlManagerOpen}
        onClose={() => setIsUrlManagerOpen(false)}
        apps={apps}
        onSaveApps={handleSaveApps}
        onResetDefaults={handleResetDefaultApps}
      />

      {/* Database Multi-tenant & SSO Architecture Specification Modal */}
      <DatabaseArchitectureModal
        isOpen={isDbArchitectureOpen}
        onClose={() => setIsDbArchitectureOpen(false)}
      />

      {/* Application SSO Launch and Handshake Simulation Modal */}
      <AppLaunchModal
        isOpen={!!launchingApp}
        onClose={() => setLaunchingApp(null)}
        app={launchingApp}
        user={user}
        onSelectPass={() => handleChangePlan('ecosystem')}
        onSelectSingleApp={(appId) => handleChangePlan('app', [appId])}
      />

      {/* VIP Access Code Modal (Usage unique strict & Registre Admin) */}
      <VipCodeModal
        isOpen={isVipModalOpen}
        onClose={() => setIsVipModalOpen(false)}
        user={user}
        initialTab={vipModalTab}
        onCodeSuccessfullyActivated={handleCodeSuccessfullyActivated}
      />

    </div>
  );
}
