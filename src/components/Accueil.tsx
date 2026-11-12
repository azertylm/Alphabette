import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { RegistryApp } from '../types';
import { fetchPublicApps } from '../services/registryService';
import { RegistryIcon } from './RegistryIcon';

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
        <h1 className="accueil__titre">
          Des applications simples, <em>pour mieux vivre au quotidien.</em>
        </h1>
        <p className="accueil__phrase">
          {apps.length ? apps.filter((app) => app.slug !== 'petits-jeux').length : appsCount} applications faites à La
          Grande-Motte. Sans publicité.
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

        <div className="accueil__tuiles">
          {visibles.map((app) => (
            <a key={app.id} className="accueil__tuile" href={app.url || '#'}>
              <span className="accueil__icone" aria-hidden="true">
                <RegistryIcon name={app.icon} />
              </span>
              <strong>{nomLisible(app.name)}</strong>
              {app.description && <span className="accueil__desc">{app.description}</span>}
              {(app.gratuit || app.badge === 'Nouveau') && (
                <span className="accueil__pastilles">
                  {app.gratuit && <span className="accueil__pastille accueil__pastille--gratuit">Gratuit</span>}
                  {app.badge === 'Nouveau' && <span className="accueil__pastille">Nouveau</span>}
                </span>
              )}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
};
