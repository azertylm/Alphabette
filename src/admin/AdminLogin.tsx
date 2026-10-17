import React, { useState } from 'react';
import { ArrowLeft, KeyRound, Lock, ShieldAlert } from 'lucide-react';
import { adminLogin } from '../services/registryService';

/**
 * @file AdminLogin.tsx
 * Écran de connexion de la console d'administration ALPHABETTE.
 * Le mot de passe est comparé côté serveur (variable ADMIN_PASSWORD),
 * puis remplacé par un cookie de session httpOnly signé.
 */

interface AdminLoginProps {
  onSuccess: () => void;
  configured: boolean;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, configured }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await adminLogin(password);
      setPassword('');
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Connexion impossible.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-xs font-semibold mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Retour à alphabette.fr</span>
        </a>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-slate-950 flex items-center justify-center font-black text-xl">
              α
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight">Console d'administration</h1>
              <p className="text-[11px] text-emerald-400 font-medium">Registre des applications ALPHABETTE</p>
            </div>
          </div>

          {!configured && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Aucun mot de passe défini. Ajoutez <code className="font-bold">ADMIN_PASSWORD</code> dans le fichier
                <code className="font-bold"> .env</code> puis redémarrez le serveur.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mb-1.5">
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                Mot de passe administrateur
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                autoFocus
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </label>

            {error && (
              <p className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !password.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-sm transition-colors cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{isSubmitting ? 'Vérification…' : 'Déverrouiller la console'}</span>
            </button>
          </form>

          <p className="mt-5 text-[11px] text-slate-500 leading-relaxed">
            Session valable 8 heures, conservée dans un cookie sécurisé <code>httpOnly</code>.
            Cinq tentatives échouées bloquent temporairement l'accès.
          </p>
        </div>
      </div>
    </div>
  );
};
