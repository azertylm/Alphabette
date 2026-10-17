import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { RegistryApp } from '../types';
import { adminLogout, checkAdminSession, fetchAdminApps } from '../services/registryService';
import { AdminLogin } from './AdminLogin';
import { AdminDashboard } from './AdminDashboard';

/**
 * @file AdminApp.tsx
 * Point d'entrée de la console /admin.
 * Vérifie la session (cookie signé) puis affiche soit l'écran de connexion,
 * soit le tableau de bord du registre des applications.
 */

type AdminState = 'loading' | 'login' | 'dashboard';

export const AdminApp: React.FC = () => {
  const [state, setState] = useState<AdminState>('loading');
  const [apps, setApps] = useState<RegistryApp[]>([]);
  const [configured, setConfigured] = useState(true);

  const openDashboard = useCallback(async () => {
    const registryApps = await fetchAdminApps();
    setApps(registryApps);
    setState('dashboard');
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const session = await checkAdminSession();
        if (cancelled) return;
        setConfigured(session.configured);
        if (session.authenticated) {
          await openDashboard();
        } else {
          setState('login');
        }
      } catch {
        if (!cancelled) setState('login');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openDashboard]);

  const handleLogout = async () => {
    try {
      await adminLogout();
    } finally {
      setApps([]);
      setState('login');
    }
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center gap-3 text-slate-400 text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
        <span>Vérification de la session administrateur…</span>
      </div>
    );
  }

  if (state === 'login') {
    return <AdminLogin configured={configured} onSuccess={openDashboard} />;
  }

  return <AdminDashboard initialApps={apps} onLogout={handleLogout} />;
};
