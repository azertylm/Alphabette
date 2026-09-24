import React, { useState } from 'react';
import { 
  X, 
  Save, 
  Link as LinkIcon, 
  PlusCircle, 
  Trash2, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw,
  Sparkles,
  HelpCircle,
  Layers
} from 'lucide-react';
import { AppItem, AppCategory } from '../types';
import { CATEGORIES } from '../data/initialApps';

interface UrlManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  apps: AppItem[];
  onSaveApps: (apps: AppItem[]) => void;
  onResetDefaults: () => void;
}

export const UrlManagerModal: React.FC<UrlManagerModalProps> = ({
  isOpen,
  onClose,
  apps,
  onSaveApps,
  onResetDefaults
}) => {
  const [editableApps, setEditableApps] = useState<AppItem[]>(apps);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleUpdateField = (id: string, field: keyof AppItem, value: any) => {
    setEditableApps(prev => prev.map(app => {
      if (app.id === id) {
        const updated = { ...app, [field]: value };
        if (field === 'url') {
          // Check if valid non-empty url
          updated.isConfigured = !!value && value.trim().length > 5 && !value.includes('[COLLER');
        }
        return updated;
      }
      return app;
    }));
  };

  const handleAddNewApp = () => {
    const nextSlot = editableApps.length + 1;
    const newApp: AppItem = {
      id: `app-slot-${nextSlot}`,
      slotNumber: nextSlot,
      name: `APPLICATION ${nextSlot}`,
      pole: 'citoyen_proximite',
      category: 'Citoyen & Proximité',
      tagline: 'Nouvelle application de l’écosystème ALPHABETTE',
      description: 'Description de la solution citoyenne et éthique.',
      url: 'https://',
      isConfigured: false,
      tags: ['Souverain', 'ALPHABETTE'],
      iconName: 'Layers',
      pricingNote: '15 € TTC / an'
    };
    setEditableApps(prev => [...prev, newApp]);
  };

  const handleDeleteApp = (id: string) => {
    if (confirm('Voulez-vous supprimer cet emplacement d’application ?')) {
      setEditableApps(prev => prev.filter(app => app.id !== id).map((a, idx) => ({
        ...a,
        slotNumber: idx + 1
      })));
    }
  };

  const handleSaveAll = () => {
    onSaveApps(editableApps);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Gestionnaire des URLs & Liens</h3>
              <p className="text-xs text-slate-300">
                Collez ici vos liens réels pour les 10 premières applications (extensible jusqu'à 50+).
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice Info Box */}
        <div className="bg-purple-50 p-4 border-b border-purple-100 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
          <div className="text-xs text-purple-900 space-y-1">
            <p className="font-semibold">
              Espace de configuration des liens (Valentin RICHAUD) :
            </p>
            <p className="text-purple-700 leading-relaxed">
              Vous pouvez coller vos adresses web réelles (ex: <code>https://mon-domaine-lidarsol.fr</code>). Dès que vous enregistrez, les boutons "Lancer l'app" du Hub redirigeront vos utilisateurs directement vers vos services avec la transmission de session SSO.
            </p>
          </div>
        </div>

        {/* Scrollable List of App Slots */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
          {editableApps.map((app) => (
            <div 
              key={app.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all space-y-4"
            >
              {/* Top line: Slot and Name */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                    Slot #{app.slotNumber < 10 ? `0${app.slotNumber}` : app.slotNumber}
                  </span>
                  <input
                    type="text"
                    value={app.name}
                    onChange={(e) => handleUpdateField(app.id, 'name', e.target.value)}
                    placeholder="Nom de l'application"
                    className="font-bold text-slate-900 text-base border-b border-transparent hover:border-slate-300 focus:border-emerald-600 focus:outline-hidden px-1 py-0.5"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={app.category}
                    onChange={(e) => handleUpdateField(app.id, 'category', e.target.value as AppCategory)}
                    className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-slate-700 font-medium focus:ring-1 focus:ring-emerald-500"
                  >
                    {CATEGORIES.filter(c => c !== 'Toutes').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  {editableApps.length > 1 && (
                    <button
                      onClick={() => handleDeleteApp(app.id)}
                      title="Supprimer ce slot"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Tagline & Description Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Sous-titre / Thème
                  </label>
                  <input
                    type="text"
                    value={app.tagline}
                    onChange={(e) => handleUpdateField(app.id, 'tagline', e.target.value)}
                    placeholder="Courte phrase d'accroche..."
                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-1.5 text-slate-800 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={app.description}
                    onChange={(e) => handleUpdateField(app.id, 'description', e.target.value)}
                    placeholder="Description concise du service..."
                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-1.5 text-slate-800 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* The URL Field - Core Requirement */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-purple-600" />
                    <span>Lien officiel / URL cible de l'application :</span>
                  </label>
                  {app.url && !app.url.includes('[COLLER') ? (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Configuré
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> En attente de lien
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={app.url}
                    onChange={(e) => handleUpdateField(app.id, 'url', e.target.value)}
                    placeholder="[COLLER LE LIEN ICI - ex: https://mon-service.alphabette.fr]"
                    className="flex-1 font-mono text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                  {app.url && (
                    <a
                      href={app.url.startsWith('http') ? app.url : `https://${app.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl text-slate-700 text-xs font-medium flex items-center gap-1 shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Tester</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Add Slot Button */}
          <div className="text-center pt-2">
            <button
              onClick={handleAddNewApp}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border-2 border-dashed border-slate-300 hover:border-purple-500 text-slate-700 hover:text-purple-700 text-xs font-bold transition-all cursor-pointer bg-white"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Ajouter le Slot #{editableApps.length + 1} (Objectif 50+)</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={onResetDefaults}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rétablir les 10 slots initiaux</span>
            </button>
            {saveSuccess && (
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Sauvegardé avec succès !
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
            >
              Fermer
            </button>
            <button
              onClick={handleSaveAll}
              className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 flex items-center justify-center gap-1.5 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer les liens</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
