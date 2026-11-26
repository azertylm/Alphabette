import React, { useEffect, useRef, useState } from 'react';
import { AIDE_LABORATOIRE, LIBELLE_AIDE, type EntreeAide } from './messages';

/**
 * @file OctetHelp.tsx
 * Bouton « Besoin d'un coup de patte ? » + panneau d'aide contextuel (questions fréquentes statiques, sans IA).
 * Accessibilité : dialogue modal (role=dialog, aria-modal), focus déplacé sur le titre à l'ouverture, Tab piégé dans le panneau,
 * fermeture par Échap / bouton / clic hors panneau, focus rendu au bouton d'origine. Aucune donnée collectée.
 */

interface Props { titre?: string; entrees?: EntreeAide[]; libelle?: string }

export const OctetHelp: React.FC<Props> = ({ titre = 'Aide du Laboratoire d’Octet', entrees = AIDE_LABORATOIRE, libelle = LIBELLE_AIDE }) => {
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  const panneau = useRef<HTMLDivElement>(null);
  const titreRef = useRef<HTMLHeadingElement>(null);

  const fermer = () => { setOuvert(false); setTimeout(() => bouton.current?.focus(), 0); };

  useEffect(() => { if (ouvert) titreRef.current?.focus(); }, [ouvert]);

  const touche = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); fermer(); return; }
    if (e.key !== 'Tab' || !panneau.current) return;
    const f = Array.from(panneau.current.querySelectorAll<HTMLElement>('button, a[href], summary, [tabindex="0"]'));
    if (!f.length) return;
    const premier = f[0], dernier = f[f.length - 1], actif = document.activeElement;
    if (e.shiftKey && (actif === premier || actif === titreRef.current)) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && actif === dernier) { e.preventDefault(); premier.focus(); }
  };

  return (
    <>
      <button ref={bouton} type="button" className="labo__bouton octet-aide__bouton" aria-haspopup="dialog" aria-expanded={ouvert} onClick={() => setOuvert(true)}>{libelle}</button>
      {ouvert && (
        <div className="octet-aide__fond" onMouseDown={(e) => { if (e.target === e.currentTarget) fermer(); }}>
          <div ref={panneau} className="octet-aide" role="dialog" aria-modal="true" aria-labelledby="octet-aide-titre" onKeyDown={touche}>
            <h2 id="octet-aide-titre" ref={titreRef} tabIndex={-1} className="octet-aide__titre">{titre}</h2>
            <div className="octet-aide__liste">
              {entrees.map((e) => (
                <details key={e.cle} className="octet-aide__q">
                  <summary>{e.question}</summary>
                  <p>{e.reponse}</p>
                </details>
              ))}
            </div>
            <button type="button" className="labo__bouton octet-aide__fermer" onClick={fermer}>Fermer l’aide</button>
          </div>
        </div>
      )}
    </>
  );
};
