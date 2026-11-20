import React, { useEffect, useState } from 'react';
import { chargerIdees, ideesVotees, proposerIdee, refusIdee, voterIdee, type Idee } from './collectif';

/**
 * @file BoiteIdees.tsx
 * « Quelle prochaine appli ? » (alphabette.eu) : proposer une idée courte (titre + une phrase) et voter.
 * Sans compte : 1 vote par idée et par appareil (localStorage), vérifié aussi par api/collectif.php
 * (empreinte du jour, jamais l'adresse IP). Idées triées par votes décroissants.
 */

const tri = (l: Idee[]) => [...l].sort((a, b) => b.votes - a.votes || b.date.localeCompare(a.date));

export const BoiteIdees: React.FC = () => {
  const [idees, setIdees] = useState<Idee[] | null | 'chargement'>('chargement');
  const [votees, setVotees] = useState<string[]>(() => ideesVotees());
  const [titre, setTitre] = useState('');
  const [phrase, setPhrase] = useState('');
  const [piege, setPiege] = useState('');
  const [etat, setEtat] = useState<'' | 'envoi' | 'ok' | 'erreur'>('');
  const [message, setMessage] = useState('');
  const [messageVote, setMessageVote] = useState<{ id: string; texte: string } | null>(null);
  const [toutes, setToutes] = useState(false);

  useEffect(() => { chargerIdees().then((l) => setIdees(l ? tri(l) : null)); }, []);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    const refus = refusIdee(titre, phrase);
    if (refus) { setEtat('erreur'); setMessage(refus); return; }
    setEtat('envoi');
    const r = await proposerIdee(titre, phrase, piege);
    setEtat(r.ok ? 'ok' : 'erreur');
    setMessage(r.message);
    if (r.ok && r.idee) {
      const nouvelle = r.idee;
      setIdees((l) => tri([...(Array.isArray(l) ? l : []), nouvelle]));
      setVotees(ideesVotees());
      setTitre('');
      setPhrase('');
    }
  };

  const voter = async (id: string) => {
    if (votees.includes(id)) return;
    const r = await voterIdee(id);
    setVotees(ideesVotees());
    if (r.ok && typeof r.votes === 'number') {
      const votes = r.votes;
      // Pas de nouveau tri tout de suite : l'idée reste sous le doigt (et le focus clavier ne saute pas).
      setIdees((l) => (Array.isArray(l) ? l.map((x) => (x.id === id ? { ...x, votes } : x)) : l));
      setMessageVote({ id, texte: 'Vote enregistré, merci !' });
    } else {
      setMessageVote({ id, texte: r.message ?? 'Vote impossible pour le moment.' });
    }
  };

  const liste = Array.isArray(idees) ? (toutes ? idees : idees.slice(0, 10)) : [];

  return (
    <section id="idees" className="communaute" aria-labelledby="idees-titre">
      <h2 id="idees-titre" className="accueil__rubrique">💡 Quelle prochaine appli ?</h2>
      <p className="communaute__intro">
        Proposez l'appli qui vous manque, ou votez pour celles des autres. Les plus demandées passent en tête : le Labo
        les regarde en premier.
      </p>

      <form className="labo__form communaute__form" onSubmit={envoyer} noValidate>
        <label className="labo__champ">
          <span>Titre de l'idée</span>
          <input value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={60} placeholder="Ex. : Rappel des poubelles" autoComplete="off" aria-describedby="idee-aide" />
        </label>
        <label className="labo__champ">
          <span>En une phrase, à quoi elle servirait ?</span>
          <textarea value={phrase} onChange={(e) => setPhrase(e.target.value)} maxLength={160} rows={2} placeholder="Ex. : Me prévenir la veille du jour de collecte de ma rue." aria-describedby="idee-aide" />
        </label>
        <label className="labo__piege" aria-hidden="true">
          Ne pas remplir <input tabIndex={-1} value={piege} onChange={(e) => setPiege(e.target.value)} autoComplete="off" />
        </label>
        <p id="idee-aide" className="labo__petit">
          Publique tout de suite, sans compte. Pas de lien, d'e-mail ni de numéro de téléphone ; les idées hors sujet sont retirées.
        </p>
        <button type="submit" className="labo__bouton labo__bouton--envoyer" disabled={etat === 'envoi'}>
          {etat === 'envoi' ? 'Envoi…' : 'Proposer mon idée'}
        </button>
        {message && (
          <p className={etat === 'erreur' ? 'labo__message labo__message--erreur' : 'labo__message'} role={etat === 'erreur' ? 'alert' : 'status'}>
            {message}
          </p>
        )}
      </form>

      {idees === 'chargement' && <p className="accueil__message">Chargement des idées…</p>}
      {idees === null && <p className="accueil__message">Les idées n'ont pas pu être chargées. Réessayez plus tard.</p>}
      {Array.isArray(idees) && idees.length === 0 && (
        <p className="communaute__vide">Aucune idée pour l'instant : la vôtre sera la première.</p>
      )}
      {liste.length > 0 && (
        <ol className="idees" aria-label="Idées proposées, de la plus votée à la moins votée">
          {liste.map((idee) => {
            const deja = votees.includes(idee.id);
            return (
              <li key={idee.id} className="idees__idee">
                <div className="idees__texte">
                  <strong>{idee.titre}</strong>
                  {idee.statut === 'retenue' && <span className="collectif-statut collectif-statut--validee"> Retenue par le Labo</span>}
                  {idee.statut === 'realisee' && <span className="collectif-statut collectif-statut--validee"> ✓ Réalisée</span>}
                  <span>{idee.phrase}</span>
                  {messageVote?.id === idee.id && <span className="labo__petit" role="status">{messageVote.texte}</span>}
                </div>
                <button type="button" className={deja ? 'idees__vote idees__vote--fait' : 'idees__vote'} onClick={() => voter(idee.id)}
                  aria-disabled={deja} aria-label={`${deja ? 'Déjà voté pour' : 'Voter pour'} « ${idee.titre} », ${idee.votes} vote${idee.votes > 1 ? 's' : ''}`}>
                  <span aria-hidden="true">{deja ? '✓' : '▲'}</span>
                  <span className="idees__nombre">{idee.votes}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {Array.isArray(idees) && idees.length > 10 && (
        <button type="button" className="labo__bouton" onClick={() => setToutes(!toutes)} aria-expanded={toutes}>
          {toutes ? 'Voir seulement les 10 premières' : `Voir les ${idees.length} idées`}
        </button>
      )}
    </section>
  );
};
