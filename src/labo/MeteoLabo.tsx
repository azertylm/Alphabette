import React, { useEffect, useState } from 'react';
import { chargerStatutLabo, ilYa, partiesParis, prochainPassage, type StatutLabo } from './labo';

/**
 * @file MeteoLabo.tsx
 * « La Météo du Labo » : bandeau compact en haut d'alphabette.eu.
 *  - compte à rebours jusqu'au prochain passage des agents (tous les jours à 21 h 13, heure de Paris) ;
 *  - avis en file d'attente (lu en direct : api/feedback.php, champ file_attente) ;
 *  - état de la Sentinelle (api/labo/status-labo.json, calculé depuis ses vrais retours arrière).
 * Donnée absente → « — » et une phrase honnête : rien n'est inventé.
 */

const deux = (n: number) => String(n).padStart(2, '0');
const JOUR = 86400e3;

interface Props {
  /** Nombre d'avis à traiter ; undefined = pas encore chargé ou inconnu. */
  fileAttente?: number;
  /** false si le service des avis ne répond pas. */
  serveurAvis: boolean | null;
  /** Noms lisibles des applis (id du registre → nom), pour la Sentinelle. */
  noms?: Record<string, string>;
}

export const MeteoLabo: React.FC<Props> = ({ fileAttente, serveurAvis, noms = {} }) => {
  const [statut, setStatut] = useState<StatutLabo | null | 'chargement'>('chargement');
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    chargerStatutLabo().then(setStatut);
    const t = window.setInterval(() => setMaintenant(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const cible = prochainPassage(new Date(maintenant));
  const reste = Math.max(0, Math.floor((cible.getTime() - maintenant) / 1000));
  const h = Math.floor(reste / 3600);
  const m = Math.floor((reste % 3600) / 60);
  const s = reste % 60;
  const jourParis = (t: number) => { const p = partiesParis(new Date(t)); return `${p.year}-${p.month}-${p.day}`; };
  const ceSoir = jourParis(cible.getTime()) === jourParis(maintenant);

  const st = statut === 'chargement' ? null : statut;
  const nuit = st ? st.sentinelle.interventions.filter((i) => i.retour_arriere && maintenant - Date.parse(i.date) < JOUR).length : null;
  const derniere = st?.sentinelle.interventions[0];
  const file = typeof fileAttente === 'number' ? fileAttente : null;

  // Le « temps » du labo, tiré des vraies données : orage = retour arrière ces 24 h, nuages = beaucoup d'avis en attente.
  const ciel = nuit ? { icone: '⛈️', mot: 'Orage' } : file !== null && file > 10 ? { icone: '⛅', mot: 'Nuageux' } : { icone: '☀️', mot: 'Ciel dégagé' };

  return (
    <section className="meteo" aria-labelledby="meteo-titre">
      <h2 id="meteo-titre" className="meteo__titre">
        <span aria-hidden="true">{ciel.icone}</span> La Météo du Labo <span className="meteo__ciel">· {ciel.mot}</span>
      </h2>
      <ul className="meteo__grille">
        <li className="meteo__case meteo__case--chrono">
          <span className="meteo__valeur" aria-hidden="true">{h} h {deux(m)} min {deux(s)} s</span>
          <span className="meteo__libelle">
            <span aria-hidden="true">avant le passage des agents, {ceSoir ? 'ce soir' : 'demain'} à 21 h 13 (heure de Paris)</span>
            <span className="accueil__cache">
              Prochain passage des agents {ceSoir ? 'ce soir' : 'demain'} à 21 h 13, heure de Paris, dans {h} heure{h > 1 ? 's' : ''} et {m} minute{m > 1 ? 's' : ''}.
            </span>
          </span>
        </li>
        <li className="meteo__case">
          <span className="meteo__valeur">{file ?? '—'}</span>
          <span className="meteo__libelle">
            {file === null
              ? serveurAvis === false ? 'avis en attente (service momentanément indisponible)' : 'avis en attente'
              : "avis en file d'attente"}
          </span>
        </li>
        <li className="meteo__case">
          <span className="meteo__valeur">{nuit ?? '—'}</span>
          <span className="meteo__libelle">
            {nuit === null ? 'Sentinelle : état indisponible' : `retour${nuit > 1 ? 's' : ''} arrière cette nuit (Sentinelle)`}
          </span>
        </li>
      </ul>
      {st && (
        <p className="meteo__pied">
          {derniere
            ? `Dernière intervention de la Sentinelle : ${ilYa(derniere.date)}${derniere.app_id ? ` (${noms[derniere.app_id] ?? derniere.app_id})` : ''}.`
            : "La Sentinelle veille sur alphabette.fr : elle n'a encore jamais eu besoin d'intervenir."}
          {st.dernier_passage && (
            <>
              {' '}Dernier passage des agents : {ilYa(st.dernier_passage.date)}
              {st.dernier_passage.corrections !== null && `, ${st.dernier_passage.corrections} amélioration${st.dernier_passage.corrections > 1 ? 's' : ''}`}.
            </>
          )}
        </p>
      )}
    </section>
  );
};
