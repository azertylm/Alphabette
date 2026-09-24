import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { AppGrid } from './components/AppGrid';
import { PricingSection } from './components/PricingSection';
import { SovereignAiStudio } from './components/SovereignAiStudio';
import { CommitmentsSection } from './components/CommitmentsSection';
import { Footer } from './components/Footer';
import { UrlManagerModal } from './components/UrlManagerModal';
import { DatabaseArchitectureModal } from './components/DatabaseArchitectureModal';
import { AppLaunchModal } from './components/AppLaunchModal';
import { INITIAL_APPS } from './data/initialApps';
import { AppItem, UserProfile, PlanType } from './types';
import { Sparkles, CheckCircle2 } from 'lucide-react';

const STORAGE_KEY_APPS = 'alphabette_apps_v3';
const STORAGE_KEY_USER = 'alphabette_user_v3';

export default function App() {
  // 1. Applications state with localStorage persistence
  const [apps, setApps] = useState<AppItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_APPS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Erreur de lecture du cache local', e);
    }
    return INITIAL_APPS;
  });

  // 2. User Profile state with SSO session and subscription
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
      id: 'usr_valentin_richaud_01',
      name: 'Valentin RICHAUD',
      email: 'valentin@alphabette.fr',
      role: 'superadmin',
      tenantId: 'tnt_alphabette_france',
      tenantName: 'ALPHABETTE Hub Central',
      subscriptionPlan: 'alphabette_pass', // Default: Pass ALPHABETTE actif
      unlockedAppIds: ['iadebat', 'infos-perso', 'oeil-atelier', 'france-service', 'proxilien'],
      ssoSessionId: 'sso_live_89f3a1c2',
      memberSince: '2024',
      city: 'La Grande-Motte'
    };
  });

  // 3. Modal visibility states
  const [isUrlManagerOpen, setIsUrlManagerOpen] = useState(false);
  const [isDbArchitectureOpen, setIsDbArchitectureOpen] = useState(false);
  const [launchingApp, setLaunchingApp] = useState<AppItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
        : (plan === 'alphabette_pass' ? apps.map(a => a.id) : (plan === 'single_app' ? ['lidarsol'] : []))
    }));

    if (plan === 'alphabette_pass') {
      showToast('🎉 Pass ALPHABETTE activé (40 € TTC / an) ! Toutes les applications citoyennes et la suite France Service sont débloquées.');
    } else if (plan === 'single_app') {
      showToast('Formule à l\'unité activée (15 € TTC / an par application sans prélèvement mensuel).');
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
    if (confirm('Voulez-vous réinitialiser le catalogue officiel ALPHABETTE ?')) {
      setApps(INITIAL_APPS);
      showToast('Le catalogue officiel ALPHABETTE a été rétabli.');
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

      {/* 1. Header with Alphabette Logo, SSO user and subscription badge */}
      <Header
        user={user}
        onChangeUserPlan={handleChangePlan}
        onOpenUrlManager={() => setIsUrlManagerOpen(true)}
        onOpenDbArchitecture={() => setIsDbArchitectureOpen(true)}
        onOpenPricing={handleScrollToPricing}
        configuredCount={configuredCount}
        totalAppsCount={apps.length}
      />

      {/* Main Page Body */}
      <main className="flex-1">
        
        {/* 2. Hero Section: Mission, commitments, key metrics & quick links */}
        <Hero
          onOpenPricing={handleScrollToPricing}
          onOpenUrlManager={() => setIsUrlManagerOpen(true)}
          onOpenDbArchitecture={() => setIsDbArchitectureOpen(true)}
          appsCount={apps.length}
        />

        {/* 3. Dynamic App Grid: Category filters, search, responsive cards & SSO launch */}
        <AppGrid
          apps={apps}
          user={user}
          onLaunch={(app) => setLaunchingApp(app)}
          onEditUrl={() => setIsUrlManagerOpen(true)}
          onSelectSubscribe={() => handleScrollToPricing()}
          onAddNewAppSlot={handleAddNewAppSlot}
          onOpenUrlManager={() => setIsUrlManagerOpen(true)}
        />

        {/* 4. Atelier Moteur IA Souverain (Gemini -> Local -> Mistral Cloud) */}
        <SovereignAiStudio
          user={user}
          onOpenPricing={handleScrollToPricing}
        />

        {/* 5. Interactive Pricing Table: Gratuit (0€) / À la carte (1€) / Pass Complet (3€) */}
        <PricingSection
          user={user}
          apps={apps}
          onSelectPlan={handleChangePlan}
        />

        {/* 6. Commitments Section: Sovereign AI, Eco-hosting, Zero Ads, EU independence */}
        <CommitmentsSection />

      </main>

      {/* 6. Footer */}
      <Footer
        onOpenPricing={handleScrollToPricing}
        onOpenUrlManager={() => setIsUrlManagerOpen(true)}
        onOpenDbArchitecture={() => setIsDbArchitectureOpen(true)}
        appsCount={apps.length}
      />

      {/* Modals */}
      {/* URL / Links Manager Modal for Valentin RICHAUD */}
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
        onSelectPass={() => handleChangePlan('alphabette_pass')}
        onSelectSingleApp={(appId) => handleChangePlan('single_app', [appId])}
      />

    </div>
  );
}
