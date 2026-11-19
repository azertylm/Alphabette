import React, { useEffect, useRef, useState } from 'react';
import { CATEGORIES_COLLECTIF, CHARTE, proposer } from './collectif';

/**
 * @file ProposerApp.tsx
 * Fenêtre « Proposer une application » du Collectif Alphabette : la charte d'abord (4 cases),
 * puis un formulaire court. Rien n'est publié automatiquement : Valentin valide chaque appli.
 */
export const ProposerApp: React.FC<{ ouvert: boolean; onFermer: () => void }> = ({ ouvert, onFermer }) => {
  const [charte, setCharte] = useState<boolean[]>(CHARTE.map(() => false));
  const [champs, setChamps] = useState({ nom: '', url: 'https://', description: '', categorie: 'Quotidien', pseudo: '', contact: '', site_web: '' });
  const [envoi, setEnvoi] = useState<'' | 'encours' | 'ok' | 'erreur'>('');
  const [message, setMessage] = useState('');
  const dialogue = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogue.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal();
    if (!ouvert && d.open) d.close();
  }, [ouvert]);

  const charteOk = charte.every(Boolean);
  const maj = (k: keyof typeof champs) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setChamps((c) => ({ ...c, [k]: e.target.value }));

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!charteOk) return;
    setEnvoi('encours');
    const r = await proposer({ ...champs, charte });
    setEnvoi(r.ok ? 'ok' : 'erreur');
    setMessage(r.message);
  };

  return (
    <dialog ref={dialogue} className="collectif-dialogue" aria-labelledby="proposer-titre" onClose={onFermer}>
      <form className="labo__form" onSubmit={envoyer} noValidate>
        <div className="collectif-dialogue__haut">
          <h2 id="proposer-titre">Proposer une application</h2>
          <button type="button" className="collectif-dialogue__fermer" onClick={onFermer} aria-label="Fermer">✕</button>
        </div>

        {envoi === 'ok' ? (
          <>
            <p className="labo__message" role="status">✅ {message}</p>
            <p className="labo__petit">
              En attendant, ajoutez le badge du collectif en bas de votre application :{' '}
              <a className="accueil__lien" href="/rejoindre/">une ligne à copier</a>.
            </p>
            <button type="button" className="labo__bouton labo__bouton--envoyer" onClick={onFermer}>Fermer</button>
          </>
        ) : (
          <>
            <fieldset>
              <legend>La charte du collectif</legend>
              <p className="labo__petit">Cochez les 4 points pour continuer.</p>
              <div className="collectif-charte">
                {CHARTE.map((texte, i) => (
                  <label key={i} className="collectif-charte__point">
                    <input
                      type="checkbox"
                      checked={charte[i]}
                      onChange={(e) => setCharte((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
                    />
                    <span><strong>{i + 1}.</strong> {texte}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset disabled={!charteOk} className="collectif-champs">
              <label className="labo__champ">
                <span>Nom de l'application</span>
                <input required maxLength={60} value={champs.nom} onChange={maj('nom')} autoComplete="off" />
              </label>
              <label className="labo__champ">
                <span>Adresse pour la tester</span>
                <input required type="url" inputMode="url" maxLength={300} value={champs.url} onChange={maj('url')} placeholder="https://…" />
              </label>
              <label className="labo__champ">
                <span>Description courte</span>
                <textarea required maxLength={280} rows={3} value={champs.description} onChange={maj('description')} placeholder="À quoi sert-elle, pour qui ? (une ou deux phrases)" />
              </label>
              <label className="labo__champ">
                <span>Catégorie</span>
                <select value={champs.categorie} onChange={maj('categorie')}>
                  {CATEGORIES_COLLECTIF.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="labo__champ">
                <span>Votre nom ou pseudo de créateur (affiché sur la fiche)</span>
                <input required maxLength={40} value={champs.pseudo} onChange={maj('pseudo')} autoComplete="nickname" />
              </label>
              <label className="labo__champ">
                <span>Contact pour vous répondre (facultatif, jamais affiché)</span>
                <input maxLength={120} value={champs.contact} onChange={maj('contact')} placeholder="e-mail, réseau social…" autoComplete="email" />
              </label>
              <label className="labo__piege" aria-hidden="true">
                Ne pas remplir <input tabIndex={-1} value={champs.site_web} onChange={maj('site_web')} autoComplete="off" />
              </label>
              <p className="labo__petit">
                Votre proposition est examinée par Alphabette avant toute publication. Le contact sert uniquement à vous
                répondre ; il n'est ni affiché ni partagé. Votre adresse IP n'est pas conservée.
              </p>
              {envoi === 'erreur' && <p className="labo__message labo__message--erreur" role="alert">{message}</p>}
              <button type="submit" className="labo__bouton labo__bouton--envoyer" disabled={!charteOk || envoi === 'encours'}>
                {envoi === 'encours' ? 'Envoi…' : 'Envoyer ma proposition'}
              </button>
            </fieldset>
          </>
        )}
      </form>
    </dialog>
  );
};
