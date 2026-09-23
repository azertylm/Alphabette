import React, { useState } from 'react';
import { 
  X, 
  Database, 
  KeyRound, 
  ShieldCheck, 
  Copy, 
  Check, 
  Cpu, 
  Layers, 
  Lock, 
  Users, 
  Server, 
  FileCode2, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { DB_TABLES, SQL_SCHEMA_SCRIPT } from '../data/dbArchitectureData';

interface DatabaseArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DatabaseArchitectureModal: React.FC<DatabaseArchitectureModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'tables' | 'architecture' | 'roles' | 'sql' | 'jwt'>('architecture');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SCHEMA_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Sample JWT SSO Payload for simulation
  const sampleJwtPayload = {
    iss: "https://auth.alphabette.fr",
    sub: "usr_8f29e1c4-7d5a-4b9e",
    tenant_id: "tnt_valentin_richaud",
    email: "valentin@alphabette.fr",
    name: "Valentin RICHAUD",
    global_role: "superadmin",
    plan: "alphabette_pass",
    unlocked_apps: ["*"], // Wildcard for 3€ Pass
    app_target: "lidarsol",
    app_role: "admin",
    scopes: ["profile", "sso:launch", "export:highres"],
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    jti: "jwt_9b472e81fc04"
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Modal Top Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">Spécifications Techniques : Base de Données Multi-Tenant & SSO</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                  PostgreSQL · Chiffrement EU
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Architecture centralisée pour 50+ applications avec isolation légère, gestion des 1€ / 3€ et rôles dynamiques.
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

        {/* Tab Navigation */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 flex items-center gap-2 overflow-x-auto text-xs font-semibold text-slate-600 no-scrollbar">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`py-3.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'architecture'
                ? 'border-emerald-600 text-emerald-900 font-bold bg-white/60'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Server className="w-4 h-4 text-emerald-600" />
            <span>Architecture Multi-Tenant & SSO</span>
          </button>

          <button
            onClick={() => setActiveTab('tables')}
            className={`py-3.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'tables'
                ? 'border-emerald-600 text-emerald-900 font-bold bg-white/60'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Schéma des 7 Tables</span>
          </button>

          <button
            onClick={() => setActiveTab('roles')}
            className={`py-3.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'roles'
                ? 'border-emerald-600 text-emerald-900 font-bold bg-white/60'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-purple-600" />
            <span>Rôles Dynamiques (RBAC)</span>
          </button>

          <button
            onClick={() => setActiveTab('jwt')}
            className={`py-3.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'jwt'
                ? 'border-emerald-600 text-emerald-900 font-bold bg-white/60'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-4 h-4 text-amber-600" />
            <span>Échange de Jeton JWT</span>
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`py-3.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'sql'
                ? 'border-emerald-600 text-emerald-900 font-bold bg-white/60'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <FileCode2 className="w-4 h-4 text-slate-800" />
            <span>Script SQL Prêt à l'Emploi</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          
          {/* TAB 1: ARCHITECTURE OVERVIEW */}
          {activeTab === 'architecture' && (
            <div className="space-y-6">
              
              {/* Sovereign Architecture Visual Diagram */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h4 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
                  <Server className="w-5 h-5 text-emerald-600" />
                  <span>Flux Centralisé Multi-Tenant & Satellite Apps</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  
                  {/* Step 1: Central IdP */}
                  <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col justify-between">
                    <div>
                      <div className="w-8 h-8 rounded-lg bg-emerald-500 text-slate-950 font-bold mx-auto mb-2 flex items-center justify-center text-xs">
                        IDP
                      </div>
                      <h5 className="font-bold text-sm text-emerald-400">ALPHABETTE Central Hub</h5>
                      <p className="text-[11px] text-slate-300 mt-1">
                        Service d'authentification centralisé (Auth SSO). Gère les tenants, comptes citoyens, abonnements (1€ ou 3€) et clés publiques.
                      </p>
                    </div>
                    <div className="mt-3 py-1 px-2 rounded bg-slate-800 text-[10px] text-slate-400 font-mono">
                      auth.alphabette.fr
                    </div>
                  </div>

                  {/* Step 2: Handshake */}
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col justify-center items-center">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold mb-2 flex items-center justify-center text-xs">
                      JWT
                    </div>
                    <h5 className="font-bold text-sm text-emerald-900">Jeton Asymétrique Éphémère</h5>
                    <p className="text-[11px] text-emerald-800 mt-1">
                      Signature Ed25519/RS256. Valide les droits sans interroger la base centrale à chaque requête (<span className="font-semibold">&lt; 2ms</span>).
                    </p>
                    <div className="mt-2 text-xs font-mono font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-300">
                      Zero-Trust Relay
                    </div>
                  </div>

                  {/* Step 3: Satellite Applications */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 font-bold mx-auto mb-2 flex items-center justify-center text-xs">
                        APPS
                      </div>
                      <h5 className="font-bold text-sm text-slate-900">Applications Décentralisées</h5>
                      <p className="text-[11px] text-slate-600 mt-1">
                        LIDARSOL, OSOLAR, PROXILIEN, INFOS PERSO, etc. Vérification locale des claims de droits et isolation tenant.
                      </p>
                    </div>
                    <div className="mt-3 py-1 px-2 rounded bg-slate-100 text-[10px] text-slate-500 font-mono">
                      50+ applications fédérées
                    </div>
                  </div>

                </div>
              </div>

              {/* 3 Pillars of the lightweight multi-tenant model */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2 font-bold text-xs">
                    01
                  </div>
                  <h5 className="font-bold text-slate-900 text-sm">Isolation par Row Level Security (RLS)</h5>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Une seule base PostgreSQL légère mais ultra-sécurisée. La colonne <code>tenant_id</code> combinée aux politiques RLS garantit qu'un foyer ou une collectivité ne peut jamais voir les données d'un autre tenant.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2 font-bold text-xs">
                    02
                  </div>
                  <h5 className="font-bold text-slate-900 text-sm">Permissions Dynamiques par Application</h5>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Chaque utilisateur a un rôle global (superadmin, citoyen) et des permissions fines par application (ex: Valentin est <code>admin</code> sur Lidarsol et un membre de quartier est <code>contributeur</code> sur Proxilien).
                  </p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center mb-2 font-bold text-xs">
                    03
                  </div>
                  <h5 className="font-bold text-slate-900 text-sm">Modèle Économique Hybride (1€ vs 3€)</h5>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Si <code>plan_type = 'alphabette_pass'</code>, l'accès est calculé comme débloqué pour toutes les applications actuelles et futures. Si <code>plan_type = 'single_app'</code>, la table <code>subscription_single_apps</code> filtre au cas par cas.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: 7 TABLES DETAILED VIEW */}
          {activeTab === 'tables' && (
            <div className="space-y-4">
              {DB_TABLES.map((table) => (
                <div key={table.name} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                        TABLE {table.name}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      {table.purpose}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-2 pr-3">Champ</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Contraintes & Index</th>
                          <th className="py-2 pl-3">Rôle Métier</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {table.fields.map((field) => (
                          <tr key={field.name} className="hover:bg-slate-50/70">
                            <td className="py-2 pr-3 font-bold text-slate-900">{field.name}</td>
                            <td className="py-2 px-3 text-purple-700">{field.type}</td>
                            <td className="py-2 px-3 text-slate-500">{field.constraints}</td>
                            <td className="py-2 pl-3 font-sans text-slate-600 text-xs">{field.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: RBAC DYNAMIC ROLES */}
          {activeTab === 'roles' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h4 className="font-bold text-slate-900 text-base mb-2">
                  Matrice des Rôles Dynamiques Inter-Applications
                </h4>
                <p className="text-xs text-slate-600 mb-6">
                  Le système d'authentification centralisé Alphabette injecte dans le jeton SSO les permissions contextuelles selon l'application cible.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/60">
                    <div className="text-xs font-bold text-purple-900 uppercase">Superadmin</div>
                    <div className="text-sm font-extrabold text-slate-900 mt-1">Valentin RICHAUD</div>
                    <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                      <li>• Gestion des 50+ applications</li>
                      <li>• Déploiement des clés SSO</li>
                      <li>• Supervision souveraine et RGPD</li>
                      <li>• Accès illimité à tous les tenants</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60">
                    <div className="text-xs font-bold text-blue-900 uppercase">Tenant Admin</div>
                    <div className="text-sm font-extrabold text-slate-900 mt-1">Gestionnaire d'Espace</div>
                    <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                      <li>• Gestion des comptes du foyer/collectivité</li>
                      <li>• Choix des formules (1€ ou 3€)</li>
                      <li>• Facturation SEPA et TVA</li>
                      <li>• Attribution des droits internes</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60">
                    <div className="text-xs font-bold text-emerald-900 uppercase">App Manager / Expert</div>
                    <div className="text-sm font-extrabold text-slate-900 mt-1">Spécialiste Métier</div>
                    <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                      <li>• Ex: Installateur photovoltaïque sur Lidarsol</li>
                      <li>• Ex: Coordinateur de quartier sur Proxilien</li>
                      <li>• Exportation avancée de données</li>
                      <li>• Modération des échanges</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="text-xs font-bold text-slate-700 uppercase">Citizen Member</div>
                    <div className="text-sm font-extrabold text-slate-900 mt-1">Utilisateur Citoyen</div>
                    <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                      <li>• Connexion SSO instantanée</li>
                      <li>• Calculs, diagnostics et entraide</li>
                      <li>• Zéro publicité & traçage</li>
                      <li>• Maîtrise totale de ses données</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* JSON Scoped Permissions Example */}
              <div className="bg-slate-900 text-slate-200 p-5 rounded-2xl font-mono text-xs overflow-x-auto">
                <div className="text-slate-400 text-[11px] mb-2 font-sans font-semibold">
                  Exemple d’attributs fins stockés dans <code>user_app_permissions.scoped_permissions (JSONB)</code> :
                </div>
                <pre className="text-emerald-400">{JSON.stringify({
                  "application": "lidarsol",
                  "role": "expert_installer",
                  "max_cadastre_exports_per_day": 250,
                  "can_export_dwg_3d": true,
                  "allowed_territories": ["75", "13", "69", "31"],
                  "mistral_ai_quota_tokens": 500000
                }, null, 2)}</pre>
              </div>
            </div>
          )}

          {/* TAB 4: JWT SSO SIMULATION */}
          {activeTab === 'jwt' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h4 className="font-bold text-slate-900 text-base mb-1">
                  Payload du Jeton SSO (JSON Web Token)
                </h4>
                <p className="text-xs text-slate-600 mb-4">
                  Lorsqu'un citoyen clique sur "Lancer l'app", Alphabette signe ce jeton avec sa clé privée. L'application réceptrice (ex: Lidarsol) vérifie la signature avec la clé publique et autorise l'accès en moins de 2 millisecondes.
                </p>

                <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-xs overflow-x-auto">
                  <pre className="text-emerald-400">{JSON.stringify(sampleJwtPayload, null, 2)}</pre>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs text-emerald-950 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>Avantage de l'architecture pour Valentin RICHAUD :</span>
                </div>
                <p className="text-emerald-800 leading-relaxed">
                  Grâce au claim <code>plan: "alphabette_pass"</code> et <code>unlocked_apps: ["*"]</code>, vous n'avez pas besoin de mettre à jour 50 applications différentes quand un utilisateur s'abonne : chaque application sait instantanément si le Pass à 3€ est actif !
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: SQL DDL SCRIPT */}
          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 font-medium">
                  Script PostgreSQL 15+ complet avec extensions, clés étrangères et index de performance.
                </span>
                <button
                  onClick={handleCopySql}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copié dans le presse-papier !' : 'Copier le script SQL'}</span>
                </button>
              </div>

              <div className="bg-slate-900 text-slate-200 p-4 sm:p-6 rounded-2xl font-mono text-xs overflow-x-auto max-h-[500px]">
                <pre>{SQL_SCHEMA_SCRIPT}</pre>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Conçu pour la société ALPHABETTE · Valentin RICHAUD
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
