import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { Loader2 } from 'lucide-react';
import App from './App.tsx';
import { resolveEffectivePath } from './appRoutes';
import './index.css';

/**
 * Routage de l'écosystème alphabette.fr.
 *
 *  - goatchevretheking.alphabette.fr  -> application Goat Chèvre The King
 *  - /goat                            -> la même application, par son chemin
 *  - /goat/communaute                 -> galerie des pyramides partagées
 *  - /admin                           -> console d'administration
 *  - /                                -> vitrine et hub central (SPA)
 *
 * Les applications sont chargées à la demande (code splitting) : chaque app
 * part dans son propre fichier JS, le hub reste léger, et l'écosystème peut
 * accueillir beaucoup d'applications sans alourdir la page d'accueil.
 */

const GoatApp = lazy(() => import('./goat/GoatApp').then((module) => ({ default: module.GoatApp })));
const CommunityPage = lazy(() =>
  import('./community/CommunityPage').then((module) => ({ default: module.CommunityPage })),
);
const AdminApp = lazy(() => import('./admin/AdminApp').then((module) => ({ default: module.AdminApp })));

const RouteLoader = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center gap-3">
    <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
    <span className="text-sm font-semibold text-slate-400">Chargement…</span>
  </div>
);

// Sous-domaine pris en compte : les deux adresses servent la même application.
const effectivePath = resolveEffectivePath(
  window.location.hostname,
  window.location.pathname,
  window.location.search,
);

const isAdminRoute = effectivePath === '/admin' || effectivePath.startsWith('/admin/');
const isCommunityRoute = effectivePath === '/goat/communaute' || effectivePath.startsWith('/goat/communaute/');
const isGoatRoute = effectivePath === '/goat' || effectivePath.startsWith('/goat/');

const renderRoute = () => {
  if (isAdminRoute) return <AdminApp />;
  if (isCommunityRoute) return <CommunityPage />;
  if (isGoatRoute) return <GoatApp />;
  return <App />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<RouteLoader />}>{renderRoute()}</Suspense>
  </StrictMode>,
);
