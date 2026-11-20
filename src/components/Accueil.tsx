import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { RegistryApp } from '../types';
import { fetchPublicApps } from '../services/registryService';
import { RegistryIcon } from './RegistryIcon';
import { MODE_LABO, cheminApp, chargerAtelier, chargerChangelogLabo, chargerDonneesLabo, chargerNotesCitoyennes, chargerCertificats, chargerEcoScores, chargerResumes, type CertificatReseau, type DonneesAtelier, type EcoScore, type DonneesLabo, type NoteVersion, type PassageApp, type Resumes } from '../labo/labo';
import { MeteoLabo } from '../labo/MeteoLabo';
import { AvantApres } from '../labo/AvantApres';
import { TableauHonneur } from '../labo/TableauHonneur';
import { BoiteIdees } from '../labo/BoiteIdees';
import { LaboAvis } from '../labo/LaboAvis';
import { ProposerApp } from '../labo/ProposerApp';
import { Signaler } from '../labo/Signaler';
import { chargerSoutiens, dejaSoutenu, soutenir } from '../labo/collectif';

type FiltreCollectif = 'toutes' | 'officiel' | 'communaute' | 'nouveautes' | 'test';
const FILTRES: { id: FiltreCollectif; nom: string }[] = [
  { id: 'toutes', nom: 'Toutes' },
  { id: 'officiel', nom: 'Officiel' },
  { id: 'communaute', nom: 'Communauté' },
  { id: 'nouveautes', nom: 'Nouveautés' },
  { id: 'test', nom: 'En test' },
];
/** « Nouveauté » : ajoutée il y a moins de 60 jours, ou marquée Nouveau dans le registre. */
const estNouvelle = (app: RegistryApp) =>
  app.badge === 'Nouveau' || (Boolean(app.createdAt) && Date.now() - new Date(app.createdAt).getTime() < 60 * 86_400_000);

/**
 * @file Accueil.tsx
 * Haut de la page d'accueil d'alphabette.fr (maquette « Kiosque clair ») :
 * une phrase simple, une recherche, puis les applications en grosses tuiles.
 *
 * Les tuiles viennent du registre central (statut « actif ») : retirer ou
 * ajouter une application dans le registre suffit, rien à modifier ici.
 * Les tailles sont en rem : le bouton BIG de la barre agrandit tout.
 */

const PETITS_MOTS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'à', 'au', 'aux', 'en', 'the']);
const SIGLES = new Set(['ia', 'lsf', 'tv']);

/** Le registre écrit les noms en capitales (« SENIOR BON PLAN ») : on les rend lisibles. */
export function nomLisible(nom: string): string {
  if (nom !== nom.toUpperCase()) return nom; // déjà écrit avec soin (« Goat Chèvre The King »)
  return nom
    .toLowerCase()
    .split(/(\s+|-|'|’)/)
    .map((mot, index) => {
      if (SIGLES.has(mot)) return mot.toUpperCase();
      if (mot.startsWith('ia') && mot.length > 2 && index === 0) return `IA ${mot.charAt(2).toUpperCase()}${mot.slice(3)}`; // IADÉBAT
      if (index > 0 && (PETITS_MOTS.has(mot) || mot === 'l' || mot === 'd')) return mot;
      return mot.charAt(0).toUpperCase() + mot.slice(1);
    })
    .join('');
}

const sansAccent = (texte: string) =>
  texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

interface AccueilProps {
  /** Nombre d'applications en ligne (affiché dans la phrase d'accroche). */
  appsCount: number;
}

export const Accueil: React.FC<AccueilProps> = ({ appsCount }) => {
  const [apps, setApps] = useState<RegistryApp[]>([]);
  const [etat, setEtat] = useState<'chargement' | 'ok' | 'erreur'>('chargement');
  const [recherche, setRecherche] = useState('');

  const charger = () => {
    setEtat('chargement');
    fetchPublicApps()
      .then((liste) => {
        setApps(liste);
        setEtat('ok');
      })
      .catch(() => setEtat('erreur'));
  };
  useEffect(charger, []);

  // Laboratoire alphabette.eu : avis des visiteurs et fichiers des agents.
  const [resumes, setResumes] = useState<Resumes | null>(null);
  const [serveurAvis, setServeurAvis] = useState<boolean | null>(null);
  const [donnees, setDonnees] = useState<DonneesLabo>({ evolutions: {}, notes: {}, maturite: {}, betas: {} });
  const [notesFr, setNotesFr] = useState<Record<string, NoteVersion[]>>({});
  const [eco, setEco] = useState<Record<string, EcoScore>>({});
  const [certs, setCerts] = useState<Record<string, CertificatReseau>>({});
  const [carteOuverte, setCarteOuverte] = useState<string | null>(null);
  const chargerAvis = () =>
    chargerResumes()
      .then((r) => {
        setResumes(r);
        setServeurAvis(true);
      })
      .catch(() => setServeurAvis(false));
  // Collectif (alphabette.eu) : filtres, soutiens, proposition d'application.
  const [filtre, setFiltre] = useState<FiltreCollectif>('toutes');
  const [soutiens, setSoutiens] = useState<Record<string, number>>({});
  const [messageSoutien, setMessageSoutien] = useState<{ id: string; texte: string } | null>(null);
  const [proposerOuvert, setProposerOuvert] = useState(false);
  // Atelier qualité (notes de la nuit, badge « Testé au Labo ») et signalements (Le Parapluie).
  const [atelier, setAtelier] = useState<DonneesAtelier>({ apps: {}, jury: {} });
  const [aSignaler, setASignaler] = useState<{ id: string; nom: string } | null>(null);
  // Bouton « Avant / Après » : dernier passage des agents par appli (api/labo/changelog-labo.json).
  const [changelog, setChangelog] = useState<Record<string, PassageApp>>({});
  const [avantApres, setAvantApres] = useState<{ id: string; nom: string } | null>(null);
  const noms = useMemo(() => Object.fromEntries(apps.map((a) => [a.id, nomLisible(a.name)])), [apps]);
  useEffect(() => {
    if (!MODE_LABO) return;
    chargerSoutiens().then(setSoutiens);
    chargerAtelier().then(setAtelier);
    chargerChangelogLabo().then(setChangelog);
    if (window.location.hash === '#proposer') setProposerOuvert(true);
  }, []);
  const soutenirApp = async (id: string) => {
    const r = await soutenir(id);
    if (r.ok && typeof r.soutiens === 'number') setSoutiens((s) => ({ ...s, [id]: r.soutiens as number }));
    setMessageSoutien({ id, texte: r.ok ? 'Merci pour votre soutien !' : r.message ?? '' });
  };

  useEffect(() => {
    if (!MODE_LABO) {
      chargerNotesCitoyennes().then(setNotesFr);
      chargerEcoScores().then(setEco);
      chargerCertificats().then(setCerts);
      return;
    }
    chargerAvis();
    chargerDonneesLabo().then(setDonnees);
  }, []);

  const gratuites = apps.filter((app) => app.gratuit).length;

  const visibles = useMemo(() => {
    const q = sansAccent(recherche.trim());
    // Sans recherche : les jeux sont regroupés derrière la tuile « Petits Jeux ».
    // Avec une recherche, on cherche partout, jeux compris.
    let liste = q
      ? apps.filter((app) => sansAccent(`${app.name} ${app.description ?? ''} ${app.createur ?? ''}`).includes(q))
      : apps.filter((app) => !app.groupe);
    if (MODE_LABO && filtre !== 'toutes') {
      liste = liste.filter((app) =>
        filtre === 'officiel' ? !app.communaute
        : filtre === 'communaute' ? Boolean(app.communaute)
        : filtre === 'nouveautes' ? estNouvelle(app)
        : !app.vitrine);
    }
    // Ordre choisi dans le registre (champ « ordre »), puis les autres par ordre alphabétique.
    return [...liste].sort(
      (a, b) => (a.ordre ?? 999) - (b.ordre ?? 999) || a.name.localeCompare(b.name, 'fr'),
    );
  }, [apps, recherche, filtre]);

  return (
    <div className="accueil">
      <section className="accueil__haut">
        {MODE_LABO && <MeteoLabo fileAttente={resumes?.file_attente} serveurAvis={serveurAvis} noms={noms} />}
        {MODE_LABO ? (
          <>
            <p className="labo-bandeau">🤝 Le Collectif Alphabette</p>
            <h1 className="accueil__titre">
              Alphabette — <em>l'atelier collectif des applications utiles et indépendantes.</em>
            </h1>
            <p className="accueil__phrase">
              Publiez votre application, améliorez-la grâce aux retours de la communauté et profitez d'une visibilité
              partagée. Les plus abouties rejoignent la vitrine <a className="accueil__lien" href="https://alphabette.fr">alphabette.fr</a>.
            </p>
            <div className="collectif-actions">
              <button type="button" className="labo__bouton labo__bouton--envoyer" onClick={() => setProposerOuvert(true)}>
                ＋ Proposer une application
              </button>
              <a className="labo__bouton" href="/rejoindre/">Rejoindre le réseau (badge)</a>
            </div>
            <p className="collectif-raccourcis">
              <a href="#tableau-honneur">🏆 Tableau d'Honneur</a>
              <a href="#idees">💡 Quelle prochaine appli ?</a>
            </p>
          </>
        ) : (
        <h1 className="accueil__titre">
          Des applications simples, <em>pour mieux vivre au quotidien.</em>
        </h1>
        )}
        <p className="accueil__phrase">
          {apps.length ? apps.filter((app) => app.slug !== 'petits-jeux').length : appsCount} applications utiles. Sans publicité.
          {gratuites > 0 && ` ${gratuites} sont gratuites, définitivement.`}
        </p>

        <label className="accueil__recherche">
          <Search aria-hidden="true" />
          <span className="accueil__cache">Chercher une application</span>
          <input
            type="search"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
            placeholder="Que cherchez-vous ?"
            autoComplete="off"
          />
        </label>
      </section>

      <section id="nos-applications" className="accueil__applis" aria-label="Nos applications">
        <h2 className="accueil__rubrique">
          {recherche.trim() ? `${visibles.length} résultat${visibles.length > 1 ? 's' : ''}` : MODE_LABO ? 'Les applications du collectif' : 'Nos applications'}
        </h2>
        {MODE_LABO && (
          <div className="collectif-filtres" role="group" aria-label="Filtrer les applications">
            {FILTRES.map((f) => (
              <button key={f.id} type="button" aria-pressed={filtre === f.id}
                className={filtre === f.id ? 'labo__puce labo__puce--choisie' : 'labo__puce'} onClick={() => setFiltre(f.id)}>
                {f.nom}
              </button>
            ))}
          </div>
        )}

        {etat === 'chargement' && <p className="accueil__message">Chargement des applications…</p>}

        {etat === 'erreur' && (
          <p className="accueil__message">
            La liste des applications n'a pas pu être chargée.{' '}
            <button type="button" className="accueil__lien" onClick={charger}>
              Réessayer
            </button>
          </p>
        )}

        {etat === 'ok' && visibles.length === 0 && (
          <p className="accueil__message">
            Aucune application ne correspond à « {recherche.trim()} ».{' '}
            <button type="button" className="accueil__lien" onClick={() => setRecherche('')}>
              Tout afficher
            </button>
          </p>
        )}

        <div className={MODE_LABO ? 'accueil__tuiles accueil__tuiles--labo' : 'accueil__tuiles'}>
          {visibles.map((app) => {
            const tuile = (
              <a key={app.id} className="accueil__tuile" href={app.url || '#'} {...(app.communaute && !app.heberge ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                <span className="accueil__icone" aria-hidden="true">
                  <RegistryIcon name={app.icon} />
                </span>
                <strong>{nomLisible(app.name)}</strong>
                {app.description && <span className="accueil__desc">{app.description}</span>}
                {!MODE_LABO && notesFr[app.id]?.[0]?.citoyenne?.[0] && (
                  <span className="accueil__nouveau">Nouveau : {notesFr[app.id][0].citoyenne[0]}</span>
                )}
                {Boolean((app as { certifie?: unknown }).certifie) && (
                  <span className="accueil__pastilles">
                    <span className="accueil__pastille accueil__pastille--certifie">✓ Certifié par la communauté</span>
                    {!MODE_LABO && eco[app.id] && (
                      <span className={`accueil__pastille accueil__pastille--eco accueil__pastille--eco-${eco[app.id].note_sobriete}`}
                        title={`Sobriété numérique ${eco[app.id].note_sobriete} (EcoIndex ${eco[app.id].ecoindex.score}/100, ${eco[app.id].poids_transfere_ko} Ko au chargement)`}>
                        🌱 Sobriété {eco[app.id].note_sobriete}
                      </span>
                    )}
                  </span>
                )}
                {!MODE_LABO && certs[app.id]?.conforme && (
                  <span className="accueil__pastilles">
                    <span className="accueil__pastille accueil__pastille--reseau"
                      title={`Audit réseau du ${new Date(certs[app.id].audite_le).toLocaleDateString('fr-FR')} : aucune donnée de votre appareil envoyée à un tiers. Certificat signé : alphabette.fr/certificats/${app.id}.json (SHA-256 ${certs[app.id].empreinte.slice(0, 12)}…)`}>
                      🔒 Zéro fuite vérifiée
                    </span>
                  </span>
                )}
                {(app.gratuit || app.badge === 'Nouveau') && (
                  <span className="accueil__pastilles">
                    {app.gratuit && <span className="accueil__pastille accueil__pastille--gratuit">Gratuit</span>}
                    {app.badge === 'Nouveau' && <span className="accueil__pastille">Nouveau</span>}
                  </span>
                )}
              </a>
            );
            if (!MODE_LABO) return tuile;
            return (
              <div key={app.id} className={carteOuverte === app.id ? 'labo-carte labo-carte--ouverte' : 'labo-carte'}>
                {tuile}
                <div className="collectif-fiche">
                  <p className="collectif-fiche__meta">
                    <span>par <strong>{app.communaute ? app.createur || 'un créateur du collectif' : 'Alphabette'}</strong></span>
                    <span className={app.vitrine ? 'collectif-statut collectif-statut--validee' : 'collectif-statut'}>
                      {app.vitrine ? '✓ Validée' : '🧪 En test'}
                    </span>
                    {app.communaute && <span className="collectif-statut collectif-statut--communaute">Communauté</span>}
                    {app.heberge && <span className="collectif-statut" title="Hébergée par Alphabette dans un cadre isolé">🔒 Isolée</span>}
                    {atelier.jury[app.id]?.teste_au_labo && (
                      <span className="collectif-statut collectif-statut--validee"
                        title={`Contrôles automatiques de l'Atelier qualité réussis (contrôle technique ${atelier.jury[app.id].controle_technique}/100) — ce n'est pas une certification`}>
                        ✓ Testé au Labo
                      </span>
                    )}
                  </p>
                  <div className="collectif-fiche__actions">
                    <a className="labo__bouton labo__bouton--envoyer" href={app.url || '#'} {...(app.communaute && !app.heberge ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                      ▶ Tester en 1 clic
                    </a>
                    <button type="button" className="labo__bouton" disabled={dejaSoutenu(app.id)} onClick={() => soutenirApp(app.id)}
                      aria-label={`Soutenir ${nomLisible(app.name)} (${soutiens[app.id] ?? 0} soutiens)`}>
                      ♥ Soutenir <span className="collectif-compteur">{soutiens[app.id] ?? 0}</span>
                    </button>
                    {changelog[app.id] && (
                      <button type="button" className="labo__bouton collectif-fiche__avant-apres" aria-haspopup="dialog"
                        onClick={() => setAvantApres({ id: app.id, nom: nomLisible(app.name) })}
                        aria-label={`Avant / Après : ce qui a changé sur ${nomLisible(app.name)} au dernier passage des agents`}>
                        ↔ Avant / Après
                      </button>
                    )}
                  </div>
                  {messageSoutien?.id === app.id && messageSoutien.texte && <p className="labo__petit" role="status">{messageSoutien.texte}</p>}
                  <p className="collectif-fiche__liens">
                    {atelier.apps[app.id] && (
                      <a href={`/atelier/${app.id}/`} title="Rapport de l'Atelier qualité : sécurité, téléphone, lisibilité, vitesse">
                        🔧 Atelier : {atelier.apps[app.id].note}/100
                      </a>
                    )}
                    <button type="button" onClick={() => setASignaler({ id: app.id, nom: nomLisible(app.name) })}>⚑ Signaler</button>
                  </p>
                </div>
                <LaboAvis
                  appId={app.id}
                  nom={nomLisible(app.name)}
                  chemin={cheminApp(app.url)}
                  resume={resumes?.apps[app.id]}
                  donnees={donnees}
                  serveurOk={serveurAvis !== false}
                  ouvert={carteOuverte === app.id}
                  onOuvrir={(ouvert) => setCarteOuverte(ouvert ? app.id : null)}
                  onMaj={chargerAvis}
                />
              </div>
            );
          })}
        </div>

        {MODE_LABO && <ProposerApp ouvert={proposerOuvert} onFermer={() => setProposerOuvert(false)} />}
        {MODE_LABO && <Signaler appId={aSignaler?.id ?? null} nom={aSignaler?.nom ?? ''} onFermer={() => setASignaler(null)} />}
        {MODE_LABO && <AvantApres app={avantApres} passage={avantApres ? changelog[avantApres.id] : undefined} onFermer={() => setAvantApres(null)} />}

        {!MODE_LABO && etat === 'ok' && (
          <p className="accueil__message accueil__labo-lien">
            🧪 D'autres applications sont en test sur le Laboratoire :{' '}
            <a className="accueil__lien" href="https://alphabette.eu">alphabette.eu</a> — essayez-les et donnez votre avis.
          </p>
        )}
      </section>

      {MODE_LABO && (
        <div className="accueil__applis communaute__zone">
          <TableauHonneur noms={noms} />
          <BoiteIdees />
        </div>
      )}
    </div>
  );
};
