import React, { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  Gift, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check,
  Plus,
  RefreshCw,
  Sliders
} from 'lucide-react';
import { verifyVipCode, getVipCodesList, generateNewVipCode } from '../services/aiService';
import { UserProfile, PlanType, VipAccessCode } from '../types';

interface VipCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onCodeSuccessfullyActivated: (plan: PlanType, durationMonths: number, note?: string) => void;
  initialTab?: 'activate' | 'generator';
}

export const VipCodeModal: React.FC<VipCodeModalProps> = ({
  isOpen,
  onClose,
  user,
  onCodeSuccessfullyActivated,
  initialTab = 'activate',
}) => {
  const [activeTab, setActiveTab] = useState<'activate' | 'generator'>(initialTab);
  
  // Activation State
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    message: string;
    durationMonths: number;
    grantedUntil: string;
    recipientNote?: string;
  } | null>(null);

  // Admin Generator State
  const [recipientNote, setRecipientNote] = useState('');
  const [durationMonths, setDurationMonths] = useState<number>(12);
  const [planGranted, setPlanGranted] = useState<'ecosystem' | 'app'>('ecosystem');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCodeResult, setGeneratedCodeResult] = useState<VipAccessCode | null>(null);
  const [vipCodesList, setVipCodesList] = useState<VipAccessCode[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      if (activeTab === 'generator' || initialTab === 'generator') {
        loadVipCodes();
      }
    }
  }, [isOpen, initialTab]);

  const loadVipCodes = async () => {
    setIsLoadingList(true);
    try {
      const list = await getVipCodesList();
      setVipCodesList(list);
    } catch (err) {
      console.error('Erreur chargement codes VIP:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  if (!isOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMsg('Veuillez saisir un code.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessData(null);

    try {
      const res = await verifyVipCode(code.trim(), user.email);
      if (res.valid) {
        setSuccessData({
          message: res.message || 'Code validé avec succès !',
          durationMonths: res.durationMonths || 12,
          grantedUntil: res.grantedUntil || new Date().toISOString(),
          recipientNote: res.recipientNote,
        });

        // Mettre à jour l'abonnement du profil
        onCodeSuccessfullyActivated('ecosystem', res.durationMonths || 12, res.recipientNote);
      } else {
        setErrorMsg(res.error || 'Code invalide ou déjà consommé.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur réseau lors de la vérification.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const record = await generateNewVipCode({
        recipientNote: recipientNote.trim() || 'Invité Privilège Alphabette',
        durationMonths,
        planGranted,
      });
      setGeneratedCodeResult(record);
      setRecipientNote('');
      await loadVipCodes();
    } catch (err: any) {
      console.error('Erreur génération code VIP:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedCode(textToCopy);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const sampleCodes = ['VIP-X89K2', 'VIP-MISTRAL75', 'VIP-PRESSE26'];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className={`bg-white rounded-3xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-fade-in transition-all ${
        activeTab === 'generator' ? 'max-w-2xl' : 'max-w-md'
      }`}>
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Moteur de Codes Privilèges & VIP</h3>
              <p className="text-xs text-slate-400">Option 1 : Usage unique strict & anti-fuite · http://alphabette.fr</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-100 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('activate')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'activate' 
                ? 'bg-white text-purple-800 border-b-2 border-purple-700 font-bold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Activer un code reçu</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('generator');
              loadVipCodes();
            }}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'generator' 
                ? 'bg-white text-purple-800 border-b-2 border-purple-700 font-bold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Générateur & Registre Admin</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          
          {/* TAB 1: ACTIVATION DU CODE */}
          {activeTab === 'activate' && (
            <div>
              {successData ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-2">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h4 className="font-extrabold text-emerald-950 text-base">
                      Félicitations ! Votre accès est activé
                    </h4>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      {successData.message}
                    </p>
                    {successData.recipientNote && (
                      <span className="inline-block text-[11px] bg-emerald-100 text-emerald-900 font-semibold px-2.5 py-0.5 rounded-full mt-1">
                        Attribution : {successData.recipientNote}
                      </span>
                    )}
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Plan accordé :</span>
                      <strong className="text-emerald-700 font-bold">Écosystème complet</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Durée offerte :</span>
                      <strong>{successData.durationMonths} mois</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Valable jusqu'au :</span>
                      <strong>{new Date(successData.grantedUntil).toLocaleDateString('fr-FR')}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Statut du code :</span>
                      <span className="text-rose-600 font-semibold">Consommé définitivement (anti-fuite)</span>
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                  >
                    Accéder à l'écosystème débloqué
                  </button>
                </div>
              ) : (
                <form onSubmit={handleVerify} className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Entrez votre code d'accès offert reçu de la part d'ALPHABETTE ou d'un partenaire.
                    Dès validation par l'API <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">POST /api/verify-code</code>, 
                    le code passe instantanément au statut <strong className="text-slate-800">consommé</strong> pour empêcher toute fuite ou réutilisation.
                  </p>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Code Privilège (format VIP-XXXXX) :
                    </label>
                    <div className="relative">
                      <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="Ex: VIP-X89K2"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-mono text-sm tracking-wider font-bold focus:outline-hidden focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                        autoFocus
                      />
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="leading-snug">{errorMsg}</div>
                    </div>
                  )}

                  {/* Codes d'exemple pour test */}
                  <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/80 text-[11px] text-purple-950 space-y-1.5">
                    <span className="font-bold block">Codes de test pré-générés disponibles :</span>
                    <div className="flex flex-wrap gap-1.5">
                      {sampleCodes.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setCode(s)}
                          className="px-2 py-0.5 rounded-md bg-white border border-purple-300 hover:bg-purple-100 font-mono text-purple-900 font-bold transition-colors cursor-pointer text-[10px]"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                    >
                      Fermer
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isLoading ? 'Vérification...' : 'Valider & Débloquer'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: GÉNÉRATEUR ET REGISTRE ADMIN */}
          {activeTab === 'generator' && (
            <div className="space-y-6">
              
              {/* Formulaire de création */}
              <form onSubmit={handleGenerateCode} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-purple-700" />
                    Créer un nouveau code à usage unique (Option 1)
                  </span>
                  <span className="text-[11px] text-purple-800 font-semibold bg-purple-100 px-2 py-0.5 rounded-full">
                    Anti-Fuite Garanti
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">Bénéficiaire / Note :</label>
                    <input
                      type="text"
                      value={recipientNote}
                      onChange={(e) => setRecipientNote(e.target.value)}
                      placeholder="Ex: Partenaire Mairie, Journaliste Tech"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">Durée offerte :</label>
                    <select
                      value={durationMonths}
                      onChange={(e) => setDurationMonths(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900"
                    >
                      <option value={1}>1 mois offert</option>
                      <option value={3}>3 mois offerts</option>
                      <option value={6}>6 mois offerts</option>
                      <option value={12}>1 an (12 mois) offert</option>
                      <option value={24}>2 ans (24 mois) offerts</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">Offre attribuée :</label>
                    <select
                      value={planGranted}
                      onChange={(e) => setPlanGranted(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900"
                    >
                      <option value="ecosystem">Écosystème complet (40 €/an)</option>
                      <option value="app">Une application au choix (15 €/an)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Gift className="w-3.5 h-3.5" />
                    <span>{isGenerating ? 'Génération...' : 'Générer le code unique'}</span>
                  </button>
                </div>
              </form>

              {/* Résultat du code généré */}
              {generatedCodeResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-emerald-800 font-semibold block">Nouveau code généré avec succès :</span>
                    <strong className="font-mono text-emerald-950 text-sm tracking-wide">{generatedCodeResult.code}</strong>
                    <span className="text-[10px] text-emerald-700 block">
                      Valable {generatedCodeResult.durationMonths} mois pour {generatedCodeResult.recipientNote}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyCode(generatedCodeResult.code)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCode === generatedCodeResult.code ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copié !</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copier</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCode(generatedCodeResult.code);
                        setActiveTab('activate');
                      }}
                      className="px-2.5 py-1.5 bg-white border border-emerald-400 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-medium cursor-pointer"
                    >
                      Tester l'activation
                    </button>
                  </div>
                </div>
              )}

              {/* Registre des codes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">
                    Registre des codes VIP existants ({vipCodesList.length}) :
                  </span>
                  <button
                    onClick={loadVipCodes}
                    disabled={isLoadingList}
                    className="text-[11px] text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingList ? 'animate-spin' : ''}`} />
                    <span>Actualiser</span>
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                  {vipCodesList.map((item) => (
                    <div key={item.code} className="p-2.5 hover:bg-slate-50 flex items-center justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{item.code}</span>
                          {item.status === 'active' && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">
                              ● Actif (En attente)
                            </span>
                          )}
                          {item.status === 'consumed' && (
                            <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.2 rounded-full">
                              ✓ Consommé
                            </span>
                          )}
                          {item.status === 'revoked' && (
                            <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-1.5 py-0.2 rounded-full">
                              Révoqué
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {item.recipientNote} · {item.durationMonths} mois
                          {item.consumedAt && ` · Consommé le ${new Date(item.consumedAt).toLocaleDateString('fr-FR')}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyCode(item.code)}
                          title="Copier le code"
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          {copiedCode === item.code ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        {item.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => {
                              setCode(item.code);
                              setActiveTab('activate');
                            }}
                            className="text-[10px] bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold px-2 py-1 rounded cursor-pointer"
                          >
                            Activer
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* Mentions RGPD & Souveraineté */}
          <div className="pt-4 mt-4 border-t border-slate-200 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Moteur souverain Mistral AI · Hub http://alphabette.fr · Usage unique strict</span>
          </div>

        </div>

      </div>
    </div>
  );
};
