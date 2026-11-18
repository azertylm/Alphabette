import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { RegistryApp } from '../types';
import { fetchPublicApps } from '../services/registryService';
import { RegistryIcon } from './RegistryIcon';
import { MODE_LABO, cheminApp, chargerDonneesLabo, chargerNotesCitoyennes, chargerEcoScores, chargerResumes, type EcoScore, type DonneesLabo, type NoteVersion, type Resumes } from '../labo/labo';
import { LaboAvis } from '../labo/LaboAvis';

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
  const [carteOuverte, setCarteOuverte] = useState<string | null>(null);
  const chargerAvis = () =>
    chargerResumes()
      .then((r) => {
        setResumes(r);
        setServeurAvis(true);
      })
      .catch(() => setServeurAvis(false));
  useEffect(() => {
    if (!MODE_LABO) {
      chargerNotesCitoyennes().then(setNotesFr);
      chargerEcoScores().then(setEco);
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
    const liste = q
      ? apps.filter((app) => sansAccent(`${app.name} ${app.description ?? ''}`).includes(q))
      : apps.filter((app) => !app.groupe);
    // Ordre choisi dans le registre (champ « ordre »), puis les autres par ordre alphabétique.
    return [...liste].sort(
      (a, b) => (a.ordre ?? 999) - (b.ordre ?? 999) || a.name.localeCompare(b.name, 'fr'),
    );
  }, [apps, recherche]);

  return (
    <div className="accueil">
      <section className="accueil__haut">
        {MODE_LABO ? (
          <>
            <p className="labo-bandeau">🧪 Le Laboratoire Alphabette</p>
            <h1 className="accueil__titre">
              Toutes nos applications en test. <em>Votre avis les améliore.</em>
            </h1>
            <p className="accueil__phrase">
              Notez, signalez un bug, proposez une idée : chaque avis est lu, et les applis évoluent. Les plus abouties
              rejoignent <a className="accueil__lien" href="https://alphabette.fr">alphabette.fr</a>.
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
          {recherche.trim() ? `${visibles.length} résultat${visibles.length > 1 ? 's' : ''}` : 'Nos applications'}
        </h2>

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
              <a key={app.id} className="accueil__tuile" href={app.url || '#'}>
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

        {!MODE_LABO && etat === 'ok' && (
          <p className="accueil__message accueil__labo-lien">
            🧪 D'autres applications sont en test sur le Laboratoire :{' '}
            <a className="accueil__lien" href="https://alphabette.eu">alphabette.eu</a> — essayez-les et donnez votre avis.
          </p>
        )}
      </section>
    </div>
  );
};
