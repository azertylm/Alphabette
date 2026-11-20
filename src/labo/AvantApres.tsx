import React, { useEffect, useRef } from 'react';
import type { PassageApp } from './labo';

/**
 * @file AvantApres.tsx
 * Fenêtre « Avant / Après » d'une carte d'alphabette.eu : ce qui a changé au dernier passage des agents,
 * en français simple (problème signalé → amélioration appliquée). Données : api/labo/changelog-labo.json.
 * Fenêtre native <dialog> : focus gardé dedans, Échap et clic à côté la ferment, le focus revient au bouton.
 */

const ORIGINE: Record<string, string> = {
  avis: 'Signalé par les visiteurs',
  controle: 'Repéré par le contrôle automatique de nuit',
  atelier: "Repéré par l'Atelier qualité",
  chaos: "Repéré par l'Agent Chaos (test de robustesse)",
};

const quand = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const jour = d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' });
  const heure = d.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', minute: '2-digit' }).replace(':', ' h ');
  return `${jour} à ${heure}`;
};

interface Props {
  /** Appli affichée ; null = fenêtre fermée. */
  app: { id: string; nom: string } | null;
  passage?: PassageApp;
  onFermer: () => void;
}

export const AvantApres: React.FC<Props> = ({ app, passage, onFermer }) => {
  const dialogue = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialogue.current;
    if (!d) return;
    if (app && passage && !d.open) d.showModal();
    if ((!app || !passage) && d.open) d.close();
  }, [app, passage]);

  return (
    <dialog
      ref={dialogue}
      className="collectif-dialogue avant-apres"
      aria-labelledby="avant-apres-titre"
      aria-describedby="avant-apres-quand"
      onClose={onFermer}
      onClick={(e) => {
        // Clic sur le fond assombri (hors du cadre) : fermer.
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onFermer();
      }}
    >
      {app && passage && (
        <div className="avant-apres__corps">
          <div className="collectif-dialogue__haut">
            <h2 id="avant-apres-titre">Avant / Après · {app.nom}</h2>
            <button type="button" className="collectif-dialogue__fermer" onClick={onFermer} aria-label="Fermer la fenêtre Avant / Après">✕</button>
          </div>
          <p id="avant-apres-quand" className="labo__petit">
            Ce qui a changé au dernier passage des agents{quand(passage.passage) ? ` (${quand(passage.passage)})` : ''}.
          </p>
          <ol className="avant-apres__liste">
            {passage.changements.map((c, i) => (
              <li key={i} className="avant-apres__changement">
                <p className="avant-apres__ligne avant-apres__ligne--avant">
                  <span className="avant-apres__etiquette">Avant</span>
                  <span>{c.probleme}</span>
                </p>
                <p className="avant-apres__fleche" aria-hidden="true">↓</p>
                <p className="avant-apres__ligne avant-apres__ligne--apres">
                  <span className="avant-apres__etiquette">Après</span>
                  <span>{c.amelioration}</span>
                </p>
                {c.origine && ORIGINE[c.origine] && (
                  <p className="labo__petit">
                    {ORIGINE[c.origine]}
                    {c.origine === 'avis' && c.avis?.length ? ` (${c.avis.length} avis)` : ''}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <button type="button" className="labo__bouton labo__bouton--envoyer" onClick={onFermer}>Fermer</button>
        </div>
      )}
    </dialog>
  );
};
