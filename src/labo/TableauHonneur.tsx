import React, { useEffect, useMemo, useState } from 'react';
import { chargerTableauHonneur, moisParis, titreHonneur, type ContributionHonneur } from './labo';
import { MecenesDuLabo } from './MecenesDuLabo';

/**
 * @file TableauHonneur.tsx
 * Tableau d'Honneur mensuel d'alphabette.eu : les pseudos dont un avis a déclenché une vraie amélioration
 * ce mois-ci (passage des agents de 21 h 13). Données : api/labo/tableau-honneur.json, rempli par
 * scripts/labo/tableau-honneur.mjs à partir des avis « implemented » qui portent un pseudo.
 * Vide → une phrase honnête, jamais de faux nom.
 */

interface Ligne { pseudo: string; retours: number; apps: string[]; premier: number }

export const TableauHonneur: React.FC<{ noms: Record<string, string> }> = ({ noms }) => {
  const [liste, setListe] = useState<ContributionHonneur[] | null | 'chargement'>('chargement');
  useEffect(() => { chargerTableauHonneur().then(setListe); }, []);

  const mois = moisParis();
  const lignes = useMemo<Ligne[]>(() => {
    if (!Array.isArray(liste)) return [];
    const parPseudo = new Map<string, Ligne>();
    for (const c of liste) {
      const t = Date.parse(c.date);
      if (!c.pseudo || Number.isNaN(t) || moisParis(new Date(t)) !== mois) continue;
      const cle = c.pseudo.trim().toLocaleLowerCase('fr');
      const l = parPseudo.get(cle) ?? { pseudo: c.pseudo.trim(), retours: 0, apps: [], premier: t };
      l.retours++;
      const nom = noms[c.app_id] ?? c.app_id;
      if (!l.apps.includes(nom)) l.apps.push(nom);
      l.premier = Math.min(l.premier, t);
      parPseudo.set(cle, l);
    }
    return [...parPseudo.values()].sort((a, b) => b.retours - a.retours || a.premier - b.premier);
  }, [liste, mois, noms]);

  const nomMois = new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', month: 'long', year: 'numeric' });

  return (
    <section id="tableau-honneur" className="communaute" aria-labelledby="honneur-titre">
      <h2 id="honneur-titre" className="accueil__rubrique">🏆 Tableau d'Honneur · {nomMois}</h2>
      <p className="communaute__intro">
        Les visiteurs dont l'avis a vraiment amélioré une appli ce mois-ci. Pour y figurer : donnez votre avis sous une appli
        et ajoutez un pseudo. Titres : 1 retour <strong>Œil de lynx</strong>, 3 retours <strong>Voix du labo</strong>,
        5 et plus <strong>Dompteur de bugs</strong>.
      </p>
      {liste === 'chargement' && <p className="accueil__message">Chargement…</p>}
      {liste === null && <p className="accueil__message">Le Tableau d'Honneur n'a pas pu être chargé. Réessayez plus tard.</p>}
      {Array.isArray(liste) && lignes.length === 0 && (
        <p className="communaute__vide">
          Personne encore ce mois-ci. Le premier avis signé qui déclenche une amélioration ouvre le tableau : ce sera peut-être le vôtre.
        </p>
      )}
      {lignes.length > 0 && (
        <ol className="honneur">
          {lignes.map((l, i) => {
            const t = titreHonneur(l.retours);
            return (
              <li key={l.pseudo} className="honneur__ligne">
                <span className="honneur__rang" aria-hidden="true">{i + 1}</span>
                <span className="honneur__qui">
                  <strong className="honneur__pseudo">{l.pseudo}</strong>
                  <span className="honneur__titre"><span aria-hidden="true">{t.icone}</span> {t.titre}</span>
                  <span className="honneur__apps">a amélioré {l.apps.join(', ')}</span>
                </span>
                <span className="honneur__compte">
                  {l.retours}<small> retour{l.retours > 1 ? 's' : ''} validé{l.retours > 1 ? 's' : ''}</small>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <MecenesDuLabo />
    </section>
  );
};
