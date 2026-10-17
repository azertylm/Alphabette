import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AdminApp } from './admin/AdminApp';
import './index.css';

/**
 * Routage minimaliste de l'écosystème alphabette.fr.
 * - /admin  -> console d'administration du registre des applications
 * - /       -> vitrine et hub central (SPA)
 * Les mêmes chemins fonctionnent en développement (Vite) et en production (fallback serveur).
 */
const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
const isAdminRoute = currentPath === '/admin' || currentPath.startsWith('/admin/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? <AdminApp /> : <App />}
  </StrictMode>,
);
