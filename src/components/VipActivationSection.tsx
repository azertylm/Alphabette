import React, { useState } from 'react';
import { 
  Key, 
  Gift, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight,
  Sparkles,
  Sliders,
  Lock,
  Check
} from 'lucide-react';
import { verifyVipCode } from '../services/aiService';
import { UserProfile, PlanType } from '../types';

interface VipActivationSectionProps {
  user: UserProfile;
  onCodeSuccessfullyActivated: (plan: PlanType, durationMonths: number, note?: string) => void;
  onOpenAdminGenerator: () => void;
}

export const VipActivationSection: React.FC<VipActivationSectionProps> = ({
  user,
  onCodeSuccessfullyActivated,
  onOpenAdminGenerator,
}) => {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    message: string;
    durationMonths: number;
    grantedUntil: string;
    recipientNote?: string;
  } | null>(null);

  const sampleCodes = ['VIP-X89K2', 'VIP-MISTRAL75', 'VIP-PRESSE26'];

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMsg('Veuillez saisir un code privilège.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessData(null);

    try {
      const res = await verifyVipCode(code.trim(), user.email);
      if (res.valid) {
        setSuccessData({
          message: res.message || 'Code activé avec succès !',
          durationMonths: res.durationMonths || 12,
          grantedUntil: res.grantedUntil || new Date().toISOString(),
          recipientNote: res.recipientNote,
        });
        onCodeSuccessfullyActivated('bouquet_integral', res.durationMonths || 12, res.recipientNote);
      } else {
        setErrorMsg(res.error || 'Code invalide ou déjà consommé.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la vérification.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="activation-vip" className="py-12 bg-slate-900 text-white relative overflow-hidden border-t border-slate-800">
      {/* Background accents */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
        
        {/* Header Title */}
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold mb-3">
            <Gift className="w-3.5 h-3.5" />
            <span>Option 1 : Usage Unique Sécurisé & Anti-Fuite</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Espace d'Activation de Code Privilège
          </h2>

          <p className="mt-2 text-sm text-slate-300">
            Vous avez reçu un code d'accès offert partenaire ou presse ? Activez-le ci-dessous pour débloquer immédiatement l'intégralité du <strong className="text-emerald-400">Bouquet Alphabette</strong> (15 applications).
          </p>
        </div>

        {/* Activation Box */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl">
          {successData ? (
            <div className="p-6 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-center space-y-3 animate-fade-in">
              <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-emerald-300">
                Accès Activé avec Succès !
              </h3>
              <p className="text-xs text-emerald-200 max-w-lg mx-auto">
                {successData.message}
              </p>
              {successData.recipientNote && (
                <div className="inline-block bg-emerald-900/60 border border-emerald-500/30 text-emerald-200 text-xs px-3 py-1 rounded-full font-semibold">
                  Attribution : {successData.recipientNote}
                </div>
              )}
              <div className="pt-2 text-xs text-slate-400">
                Statut : <span className="text-rose-400 font-semibold">Consommé définitivement (protégé contre toute fuite)</span> · Valide jusqu'au {new Date(successData.grantedUntil).toLocaleDateString('fr-FR')}
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Key className="w-5 h-5 text-slate-500 absolute left-4 top-3.5" />
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Saisissez votre code VIP (ex: VIP-X89K2)"
                    className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 font-mono text-sm tracking-wider font-bold focus:outline-hidden focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
                >
                  {isLoading ? (
                    <span>Vérification...</span>
                  ) : (
                    <>
                      <span>Activer mon code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-950/80 border border-rose-600/50 rounded-xl text-xs text-rose-200 flex items-start gap-2 animate-fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Badges de test rapide */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-400 text-[11px]">Codes de test disponibles :</span>
                  {sampleCodes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCode(s)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-purple-500 font-mono text-[11px] text-purple-300 font-bold transition-all cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onOpenAdminGenerator}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer ml-auto"
                >
                  <Sliders className="w-3.5 h-3.5 text-purple-400" />
                  <span>Générateur & Registre Admin</span>
                </button>
              </div>
            </form>
          )}

          {/* Points de sécurité */}
          <div className="mt-6 pt-5 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Consommation unique stricte</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Rejet instantané des fuites</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Accès direct aux 15 applications</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
