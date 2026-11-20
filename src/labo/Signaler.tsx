import React, { useEffect, useRef, useState } from 'react';
import { MOTIFS_SIGNALEMENT, signaler } from './collectif';

/**
 * @file Signaler.tsx
 * Fenêtre « Signaler cette application » (alphabette.eu) : motif, description, contact facultatif.
 * Le signalement part tout de suite chez Alphabette par e-mail (api/collectif.php, action « signaler »).
 */
export const Signaler: React.FC<{ appId: string | null; nom: string; onFermer: () => void }> = ({ appId, nom, onFermer }) => {
  const dialogue = useRef<HTMLDialogElement>(null);
  const [motif, setMotif] = useState<string>(MOTIFS_SIGNALEMENT[0][0]);
  const [details, setDetails] = useState('');
  const [contact, setContact] = useState('');
  const [piege, setPiege] = useState('');
  const [etat, setEtat] = useState<'' | 'encours' | 'ok' | 'erreur'>('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const d = dialogue.current;
    if (!d) return;
    if (appId && !d.open) { setEtat(''); setMessage(''); setDetails(''); d.showModal(); }
    if (!appId && d.open) d.close();
  }, [appId]);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appId) return;
    if (details.trim().length < 5) { setEtat('erreur'); setMessage('Décrivez le problème en quelques mots.'); return; }
    setEtat('encours');
    const r = await signaler({ app_id: appId, motif, details, contact, site_web: piege });
    setEtat(r.ok ? 'ok' : 'erreur');
    setMessage(r.message);
  };

  return (
    <dialog ref={dialogue} className="collectif-dialogue" aria-labelledby="signaler-titre" onClose={onFermer}>
      <form className="labo__form" onSubmit={envoyer} noValidate>
        <div className="collectif-dialogue__haut">
          <h2 id="signaler-titre">Signaler « {nom} »</h2>
          <button type="button" className="collectif-dialogue__fermer" onClick={onFermer} aria-label="Fermer">✕</button>
        </div>
        {etat === 'ok' ? (
          <>
            <p className="labo__message" role="status">✅ {message}</p>
            <button type="button" className="labo__bouton labo__bouton--envoyer" onClick={onFermer}>Fermer</button>
          </>
        ) : (
          <>
            <label className="labo__champ">
              <span>Motif</span>
              <select value={motif} onChange={(e) => setMotif(e.target.value)}>
                {MOTIFS_SIGNALEMENT.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
            <label className="labo__champ">
              <span>Ce qui pose problème</span>
              <textarea required maxLength={1000} rows={4} value={details} onChange={(e) => setDetails(e.target.value)} />
            </label>
            <label className="labo__champ">
              <span>Pour vous répondre (facultatif, jamais affiché)</span>
              <input maxLength={120} value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" />
            </label>
            <label className="labo__piege" aria-hidden="true">
              Ne pas remplir <input tabIndex={-1} value={piege} onChange={(e) => setPiege(e.target.value)} autoComplete="off" />
            </label>
            <p className="labo__petit">Le signalement part tout de suite chez Alphabette, qui l'examine sans délai. Votre adresse IP n'est pas conservée.</p>
            {etat === 'erreur' && <p className="labo__message labo__message--erreur" role="alert">{message}</p>}
            <button type="submit" className="labo__bouton labo__bouton--envoyer" disabled={etat === 'encours'}>
              {etat === 'encours' ? 'Envoi…' : 'Envoyer le signalement'}
            </button>
          </>
        )}
      </form>
    </dialog>
  );
};
