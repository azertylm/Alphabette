import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Loader2, Lock, Sparkles, User, X } from 'lucide-react';
import { CommunityUser, loginCommunity, registerCommunity } from './communityApi';
import { setCommunityUser } from './communitySession';

/**
 * @file AuthModal.tsx
 * Création de compte / connexion à la communauté.
 * Aucune adresse e-mail n'est demandée : un pseudo et un mot de passe suffisent.
 */

interface AuthModalProps {
  onClose: () => void;
  onAuthenticated?: (user: CommunityUser) => void;
  initialMode?: 'register' | 'login';
}

type Mode = 'register' | 'login';

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onAuthenticated, initialMode = 'register' }) => {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (mode === 'register' && password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (mode === 'register' && !/^[a-zA-Z0-9_-]{3,20}$/.test(username.trim())) {
      setError('Pseudo invalide : 3 à 20 caractères (lettres, chiffres, tirets, underscores).');
      return;
    }

    setIsSubmitting(true);
    try {
      const user =
        mode === 'register'
          ? await registerCommunity(username.trim(), password)
          : await loginCommunity(username.trim(), password);
      setCommunityUser(user);
      onAuthenticated?.(user);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Opération impossible pour le moment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Compte communauté"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="inline-flex items-center gap-2 text-sm font-black text-white uppercase tracking-widest">
              <Sparkles className="w-4 h-4 text-amber-400" />
              {mode === 'register' ? 'Créer mon compte' : 'Se connecter'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Publie ta pyramide et défie la communauté. Gratuit, sans e-mail.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Fermer"
            className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-950/70 border border-slate-800">
            {(['register', 'login'] as Mode[]).map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => switchMode(candidate)}
                className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors cursor-pointer ${
                  mode === candidate ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {candidate === 'register' ? 'Inscription' : 'Connexion'}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pt-4 pb-5 space-y-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Pseudo</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3">
              <User className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                value={username}
                autoComplete="username"
                onChange={(event) => setUsername(event.target.value)}
                placeholder="GoatMaster"
                maxLength={20}
                required
                className="w-full bg-transparent py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Mot de passe</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3">
              <Lock className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="password"
                value={password}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="6 caractères minimum"
                minLength={6}
                required
                className="w-full bg-transparent py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>
          </label>

          {mode === 'register' && (
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Confirmation</span>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3">
                <Check className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  type="password"
                  value={confirm}
                  autoComplete="new-password"
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="Répète ton mot de passe"
                  minLength={6}
                  required
                  className="w-full bg-transparent py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none"
                />
              </div>
            </label>
          )}

          {error && (
            <p className="flex items-start gap-2 text-[11px] font-semibold text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 text-sm font-black transition-colors cursor-pointer"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{mode === 'register' ? 'Créer mon compte' : 'Me connecter'}</span>
          </button>

          <p className="text-[10px] text-slate-500 leading-relaxed text-center">
            Ton classement reste jouable sans compte, 100 % dans ton navigateur. Un compte sert uniquement à publier
            ta pyramide dans la galerie de la communauté.
          </p>
        </form>
      </div>
    </div>
  );
};
