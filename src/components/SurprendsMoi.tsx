import React, { useEffect, useRef, useState } from 'react';
import { alphabetteAudio, useEtatAudio } from '@alphabette/shell';
import { RegistryApp } from '../types';
import { nomLisible } from './Accueil';

/**
 * « Surprends-moi » : Roue Découverte Douce. Un bouton discret tire une application au hasard (filtrable par catégorie),
 * avec une courte animation fluide — coupée en Mode Calme (`html[data-calme]`, `body.calm-mode`) et avec
 * `prefers-reduced-motion`. Le résumé peut être lu par la voix unique alphabetteAudio (jamais speechSynthesis en direct).
 */
interface Props { apps: RegistryApp[] }

const TOUTES = 'toutes';
const GRATUITES = 'gratuites';

/** Réduit les mouvements : Mode Calme d'Alphabette ou réglage du système. */
export function mouvementsReduits(): boolean {
  if (typeof document === 'undefined') return true;
  return (
    document.documentElement.hasAttribute('data-calme') ||
    document.documentElement.getAttribute('data-ab-calme') === 'oui' ||
    document.body.classList.contains('calm-mode') ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  );
}

export const SurprendsMoi: React.FC<Props> = ({ apps }) => {
  const [ouvert, setOuvert] = useState(false);
  const [categorie, setCategorie] = useState(TOUTES);
  const [defile, setDefile] = useState<string | null>(null);
  const [tire, setTire] = useState<RegistryApp | null>(null);
  const minuteur = useRef<number | undefined>(undefined);
  const etatAudio = useEtatAudio();

  useEffect(() => () => window.clearInterval(minuteur.current), []);

  const candidates = apps.filter((a) => a.url && a.status === 'actif');
  const categories = Array.from(new Set(candidates.map((a) => a.categorie).filter((c): c is string => Boolean(c)))).sort((a, b) => a.localeCompare(b, 'fr'));
  const possibles = candidates.filter((a) => (categorie === TOUTES ? true : categorie === GRATUITES ? a.gratuit : a.categorie === categorie));

  const tirer = () => {
    if (!possibles.length) { setTire(null); return; }
    window.clearInterval(minuteur.current);
    const choix = possibles[Math.floor(Math.random() * possibles.length)];
    if (mouvementsReduits() || possibles.length < 2) { setDefile(null); setTire(choix); return; }
    setTire(null);
    let n = 0;
    minuteur.current = window.setInterval(() => {
      n += 1;
      if (n >= 12) { window.clearInterval(minuteur.current); setDefile(null); setTire(choix); return; }
      setDefile(nomLisible(possibles[Math.floor(Math.random() * possibles.length)].name));
    }, 90);
  };

  const resume = tire ? `${nomLisible(tire.name)}. ${tire.description ?? ''}`.trim() : '';

  return (
    <div className="accueil__surprise">
      {!ouvert ? (
        <button type="button" className="accueil__surprise-bouton" aria-expanded="false" onClick={() => { setOuvert(true); tirer(); }}>
          <span aria-hidden="true">🎲</span> Surprends-moi
        </button>
      ) : (
        <div className="accueil__surprise-corps">
          <label className="accueil__surprise-filtre">
            <span>Dans la catégorie</span>
            <select value={categorie} onChange={(e) => { setCategorie(e.target.value); setTire(null); setDefile(null); }}>
              <option value={TOUTES}>Toutes</option>
              <option value={GRATUITES}>Gratuites</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <button type="button" className="accueil__surprise-bouton" onClick={tirer} disabled={!possibles.length}>
            <span aria-hidden="true">🎲</span> Une autre
          </button>
          <div className="accueil__surprise-resultat" role="status" aria-live="polite">
            {!possibles.length && <p>Aucune application dans cette catégorie pour le moment.</p>}
            {defile && <p className="accueil__surprise-defile" aria-hidden="true">{defile}…</p>}
            {tire && (
              <>
                <p><strong>{nomLisible(tire.name)}</strong>{tire.description ? ` — ${tire.description}` : ''}</p>
                <p className="accueil__surprise-actions">
                  <a className="accueil__lien" href={tire.url}>Ouvrir →</a>
                  <button type="button" className="accueil__surprise-ecoute" onClick={() => alphabetteAudio.basculer(resume, 'surprise')}>
                    {etatAudio === 'repos' ? '🔊 Écouter' : '⏹ Arrêter'}
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
