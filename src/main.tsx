import { StrictMode } from 'react';
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
 */

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
