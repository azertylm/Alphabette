import React, { useState, useEffect } from 'react';
import { 
  X, 
  ExternalLink, 
  KeyRound, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  Lock, 
  ArrowRight,
  Copy,
  Check,
  AlertCircle,
  Building2,
  HeartHandshake
} from 'lucide-react';
import { AppItem, UserProfile } from '../types';

interface AppLaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  app: AppItem | null;
  user: UserProfile;
  onSelectPass: () => void;
  onSelectSingleApp: (appId: string) => void;
}

export const AppLaunchModal: React.FC<AppLaunchModalProps> = ({
  isOpen,
  onClose,
  app,
  user,
  onSelectPass,
  onSelectSingleApp
}) => {
  const [isSimulatingSso, setIsSimulatingSso] = useState(true);
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSimulatingSso(true);
      const timer = setTimeout(() => {
        setIsSimulatingSso(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen, app]);

  if (!isOpen || !app) return null;

  const isProxilienFree = app.isPiloteFree;
  const isUnlockedByPass = user.subscriptionPlan === 'alphabette_pass' && !app.isB2B;
  const isUnlockedByB2B = user.subscriptionPlan === 'pro_b2b' && app.isB2B;
  const isUnlockedBySingle = user.subscriptionPlan === 'single_app' && user.unlockedAppIds.includes(app.id);
  const isUnlocked = isProxilienFree || isUnlockedByPass || isUnlockedByB2B || isUnlockedBySingle;

  // Mock SSO JWT handoff token
  const ssoToken = `eyJhbGciOiJFZDI1NTE5IiwidHlwIjoiSldUIn0.${btoa(JSON.stringify({
    sub: user.id,
    app: app.id,
    tenant: user.tenantId,
    email: user.email,
    plan: user.subscriptionPlan,
    exp: Date.now() + 3600000
  })).slice(0, 40)}...`;

  const targetUrlWithSso = app.url && app.url.startsWith('http')
    ? `${app.url}${app.url.includes('?') ? '&' : '?'}sso_token=${ssoToken}`
    : `https://${app.url || 'alphabette.fr'}`;

  const handleOpenApp = () => {
    window.open(targetUrlWithSso, '_blank', 'noopener,noreferrer');
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(ssoToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              α
            </div>
            <div>
              <h3 className="font-bold text-base text-white">{app.name}</h3>
              <p className="text-xs text-slate-400">{app.tagline}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content depending on unlock status */}
        <div className="p-6 space-y-5">
          {isUnlocked ? (
            <>
              {/* Status: Ready to Launch */}
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-950">
                  <p className="font-bold text-emerald-900">
                    Accès Débloqué & Authentification SSO Confirmée
                  </p>
                  <p className="text-emerald-800 mt-0.5">
                    {app.isPiloteFree ? (
                      <span>Accès pilote communal <strong>100% gratuit</strong> accordé pour La Grande-Motte.</span>
                    ) : (
                      <span>Votre session <strong className="font-semibold">{user.email}</strong> est transmise automatiquement. Aucun mot de passe supplémentaire n'est requis.</span>
                    )}
                  </p>
                </div>
              </div>

              {/* SSO Token details */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-semibold flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-purple-600" />
                    Jeton d'authentification SSO :
                  </span>
                  <button
                    onClick={handleCopyToken}
                    className="text-[11px] text-purple-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedToken ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedToken ? 'Copié' : 'Copier'}</span>
                  </button>
                </div>
                <div className="font-mono text-[11px] text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200 truncate">
                  {ssoToken}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>URL cible : <span className="font-mono text-slate-600">{app.url}</span></span>
                  <span className="text-emerald-600 font-semibold">Chiffrement Ed25519</span>
                </div>
              </div>

              {/* Notice if URL is not yet customized */}
              {!app.isConfigured && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Note d'exploitation :</span>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Ce slot utilise l'URL officielle ALPHABETTE. Vous pouvez ajuster le lien cible dans le <strong>Gestionnaire d'URLs</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  onClick={handleOpenApp}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Ouvrir l'application</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Application Locked View */}
              <div className="text-center py-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">
                  Cette application nécessite un abonnement
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Pour accéder à <strong className="text-slate-700">{app.name}</strong> sans publicité et de manière souveraine, découvrez les formules officielles :
                </p>
              </div>

              {/* Options based on pole */}
              {app.isB2B ? (
                <div className="space-y-3">
                  <div 
                    onClick={() => {
                      onSelectPass();
                      onClose();
                    }}
                    className="p-4 rounded-2xl border-2 border-amber-500 bg-amber-50/50 hover:bg-amber-50 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-amber-700" />
                        <span className="font-bold text-sm text-slate-900">Licence Professionnelle Solaire</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Accès illimité à {app.name} pour vos équipes d'installateurs & bureaux d'études.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-base text-slate-900">49 €</span>
                      <span className="text-xs text-slate-500"> HT / mois</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Option 1: Le Paquet Pass ALPHABETTE (40€ / an pour TOUTES les applis) */}
                  <div 
                    onClick={() => {
                      onSelectPass();
                      onClose();
                    }}
                    className="p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-emerald-950">Le Paquet Pass ALPHABETTE (Recommandé)</span>
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                          Toutes les applis
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        {app.isFranceServiceSuite ? (
                          <span>Le paquet à 40 € pour <strong>TOUTES les applications</strong> : Service France (7 modules) + IADébat + Infos Perso + L'Œil de l'Atelier.</span>
                        ) : (
                          <span>Le paquet complet pour <strong>toutes les applications</strong> : {app.name} + Service France (7 modules) + autres applications citoyennes.</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-base text-emerald-950">40 €</span>
                      <span className="text-xs text-slate-500"> TTC / an</span>
                    </div>
                  </div>

                  {/* Option 2: Single App (15€ / an pour elle) */}
                  <div 
                    onClick={() => {
                      onSelectSingleApp(app.id);
                      onClose();
                    }}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-50/30 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-900">À l'unité : {app.name}</span>
                        {app.isFranceServiceSuite && (
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full">
                            15 € pour elle
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {app.isFranceServiceSuite ? (
                          <span>Accès complet à Service France et ses 7 modules Zero-Knowledge pour 15 € / an seul, sans prélèvement mensuel.</span>
                        ) : (
                          <span>Abonnement annuel unique pour {app.name} seul, sans prélèvement mensuel.</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-base text-slate-900">15 €</span>
                      <span className="text-xs text-slate-500"> TTC / an</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 text-center">
                <button
                  onClick={onClose}
                  className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
