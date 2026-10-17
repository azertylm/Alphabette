import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { AppGrid } from './components/AppGrid';
import { AppsRegistrySection } from './components/AppsRegistrySection';
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
import { AppItem, UserProfile, PlanType } from './types';
import { Sparkles, CheckCircle2 } from 'lucide-react';

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
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Erreur de lecture du profil utilisateur', e);
    }
    return {
      id: 'usr_alphabette_admin_01',
      name: 'Direction ALPHABETTE',
      email: 'direction@alphabette.fr',
      role: 'superadmin',
      tenantId: 'tnt_alphabette_france',
      tenantName: 'ALPHABETTE Hub Central',
      subscriptionPlan: 'bouquet_integral', // Par défaut: Bouquet Intégral débloqué
      unlockedAppIds: INITIAL_APPS.map(a => a.id),
      ssoSessionId: 'sso_live_89f3a1c2',
      memberSince: '2024',
      city: 'La Grande-Motte',
      trialDaysLeft: 7,
      trialExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    };
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
        : (['bouquet_integral', 'bouquet_byok', 'alphabette_pass'].includes(plan) 
            ? apps.map(a => a.id) 
            : (['single_byok', 'single_managed', 'single_app'].includes(plan) ? ['france-service'] : []))
    }));

    if (plan === 'bouquet_integral' || plan === 'alphabette_pass') {
      showToast('🎉 Pass Bouquet Intégral activé (199 € / an) ! Les 15 applications et les clés Mistral sont incluses.');
    } else if (plan === 'bouquet_byok') {
      showToast('🎉 Pass Bouquet BYOK activé (99 € / an) ! Les 15 applications sont débloquées avec votre clé Mistral.');
    } else if (plan === 'single_managed') {
      showToast('Formule Confort activée (59 € / an · Clé Mistral gérée incluse).');
    } else if (plan === 'single_byok' || plan === 'single_app') {
      showToast('Formule BYOK activée (39 € / an · Clé Mistral client).');
    } else if (plan === 'trial_7d') {
      showToast('🎁 Période d’essai de 7 jours activée avec la clé Mistral Alphabette incluse !');
    } else if (plan === 'pro_b2b') {
      showToast('Licence Pro B2B Solaire activée (49 € HT / mois).');
    } else {
      showToast('Phase pilote La Grande-Motte activée (100% gratuit).');
    }
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
    showToast(`🎉 Code VIP validé ! Bouquet Intégral offert pour ${durationMonths} mois (${note || 'Invité Privilège'}).`);
  };

  const configuredCount = apps.filter(a => a.isConfigured).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-emerald-500 selection:text-white">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-3 animate-fade-in text-xs sm:text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header with Alphabette Logo, SSO user, Mistral AI badge and subscription status */}
      <Header
        user={user}
        onChangeUserPlan={handleChangePlan}
        onOpenUrlManager={() => setIsUrlManagerOpen(true)}
        onOpenDbArchitecture={() => setIsDbArchitectureOpen(true)}
        onOpenPricing={handleScrollToPricing}
        onOpenVipModal={() => handleOpenVipModal('activate')}
        configuredCount={configuredCount}
        totalAppsCount={visibleApps.length}
      />

      {/* Main Page Body */}
      <main className="flex-1">
        
        {/* 2. Hero Section: Mission, engagements Mistral AI, essai 7j & grille tarifaire */}
        <Hero
          onOpenPricing={handleScrollToPricing}
          onOpenUrlManager={() => setIsUrlManagerOpen(true)}
          onOpenDbArchitecture={() => setIsDbArchitectureOpen(true)}
          appsCount={visibleApps.length}
        />

        {/* 3. Dynamic App Grid: Les 15 applications métiers avec descriptif, capture & accès direct */}
        <AppGrid
          apps={visibleApps}
          user={user}
          onLaunch={(app) => setLaunchingApp(app)}
          onEditUrl={() => setIsUrlManagerOpen(true)}
          onSelectSubscribe={() => handleScrollToPricing()}
          onAddNewAppSlot={handleAddNewAppSlot}
          onOpenUrlManager={() => setIsUrlManagerOpen(true)}
        />

        {/* 3 bis. Nos Applications : registre central synchronisé (statut « actif ») */}
        <AppsRegistrySection />

        {/* 4. Atelier Moteur IA Souverain (Mistral Cloud France / Local Metal Ollama) */}
        <SovereignAiStudio
          user={user}
          onOpenPricing={handleScrollToPricing}
        />

        {/* 5. Interactive Pricing Table: 39€ / 59€ (Unité) · 99€ / 199€ (Bouquet) avec API promo & activation VIP */}
        <PricingSection
          user={user}
          apps={visibleApps}
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

      </main>

      {/* 8. Footer avec lien obligatoire vers http://alphabette.fr */}
      <Footer
        onOpenPricing={handleScrollToPricing}
        onOpenUrlManager={() => setIsUrlManagerOpen(true)}
        onOpenDbArchitecture={() => setIsDbArchitectureOpen(true)}
        appsCount={visibleApps.length}
      />

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
        onSelectPass={() => handleChangePlan('bouquet_integral')}
        onSelectSingleApp={(appId) => handleChangePlan('single_byok', [appId])}
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
