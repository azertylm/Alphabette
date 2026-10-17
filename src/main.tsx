import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AdminApp } from './admin/AdminApp';
import { GoatApp } from './goat/GoatApp';
import { CommunityPage } from './community/CommunityPage';
import './index.css';

/**
 * Routage minimaliste de l'écosystème alphabette.fr.
 * - /admin              -> console d'administration du registre des applications
 * - /goat/communaute    -> galerie des pyramides partagées par la communauté
 * - /goat               -> application Goat Chèvre The King
 * - /                   -> vitrine et hub central (SPA)
 * Les mêmes chemins fonctionnent en développement (Vite) et en production (fallback serveur).
 */
const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
const isAdminRoute = currentPath === '/admin' || currentPath.startsWith('/admin/');
const isCommunityRoute = currentPath === '/goat/communaute' || currentPath.startsWith('/goat/communaute/');
const isGoatRoute = currentPath === '/goat' || currentPath.startsWith('/goat/');

const renderRoute = () => {
  if (isAdminRoute) return <AdminApp />;
  if (isCommunityRoute) return <CommunityPage />;
  if (isGoatRoute) return <GoatApp />;
  return <App />;
};

createRoot(document.getElementById('root')!).render(<StrictMode>{renderRoute()}</StrictMode>);
