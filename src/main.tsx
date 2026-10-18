import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/**
 * Vitrine alphabette.fr — hub central de l'écosystème.
 *
 * Chaque application vit dans son **propre dépôt** et sur son **propre
 * sous-domaine** (ex. goatchevretheking.alphabette.fr), branché au dernier
 * moment. La vitrine se contente de les présenter et d'y renvoyer, à partir du
 * registre central (data/apps-registry.json) piloté depuis la console /admin.
 *
 * `/base` — aperçu vivant de la base commune (@alphabette/shell) qui équipe le
 * début de chaque nouvelle application.
 */

const BasePreview = lazy(() =>
  import('./BasePreview').then((module) => ({ default: module.BasePreview })),
);

const isBasePreview = window.location.pathname.replace(/\/+$/, '') === '/base';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isBasePreview ? (
      <Suspense fallback={null}>
        <BasePreview />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
