import React, { useEffect, useRef, useState } from 'react';
import { BoutonMicro, NOMS_FOURNISSEURS, categorieDuType, doublonsProbables, incidentRecent, ticketsOuverts, useVoiceFeedback, type TicketOuvert } from '@alphabette/shell';
import {
  AVIS_PAR_JOUR,
  CATEGORIES,
  type Categorie,
  type DonneesLabo,
  type ResumeApp,
  avisRestants,
  dejaPlus1,
  dejaVoteAb,
  envoyerAvis,
  ilYa,
  plus1,
  voterAb,
} from './labo';

/**
 * @file LaboAvis.tsx
 * Module d'avis affiché sous chaque application sur alphabette.eu :
 * note moyenne, dernière évolution, score de maturité, bêta, top 3 des demandes
 * avec +1, puis (sur demande) le formulaire : étoiles, catégorie, commentaire.
 * Tout ce qui est affiché vient des vrais avis ou des fichiers des agents :
 * sans donnée, rien n'est montré (aucun chiffre ni message inventé).
 */

const AIDE: Record<Categorie, string> = {
  Bug: "Qu'est-ce qui ne marche pas ? Sur quel écran, après quel geste ?",
  Idée: 'Quelle amélioration vous serait vraiment utile ?',
  Design: "Qu'est-ce qui est difficile à lire, à trouver ou à toucher ?",
  Autre: 'Votre remarque…',
};

const ICONE: Record<string, string> = { Bug: '🐞', Idée: '💡', Design: '🎨', Autre: '💬' };

interface Props {
  appId: string;
  nom: string;
  chemin: string;
  resume?: ResumeApp;
  donnees: DonneesLabo;
  /** false si le serveur des avis ne répond pas (le formulaire est alors masqué). */
  serveurOk: boolean;
  ouvert: boolean;
  onOuvrir: (ouvert: boolean) => void;
  onMaj: () => void;
}

export const LaboAvis: React.FC<Props> = ({ appId, nom, chemin, resume, donnees, serveurOk, ouvert, onOuvrir, onMaj }) => {
  const [note, setNote] = useState<number | null>(null);
  const [survol, setSurvol] = useState<number | null>(null);
  const [categorie, setCategorie] = useState<Categorie>('Idée');
  const [commentaire, setCommentaire] = useState('');
  const [version, setVersion] = useState<'main' | 'beta'>('main');
  const [piege, setPiege] = useState('');
  // Retour vocal : la dictée remplit catégorie, commentaire et urgence ; le visiteur relit avant d'envoyer.
  const [urgence, setUrgence] = useState<number | null>(null);
  const voix = useVoiceFeedback({
    onResultat: ({ avis }) => {
      setCategorie(categorieDuType(avis.type));
      setCommentaire(avis.resume);
      setUrgence(avis.urgence);
      setDifferent(false);
    },
  });
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'merci' | 'erreur'>('repos');
  const [message, setMessage] = useState('');
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [ab, setAb] = useState(resume?.ab);
  // Dédoublonnage en direct : tickets ouverts de l'appli, comparés au texte pendant la saisie.
  const tickets = useRef<TicketOuvert[] | null>(null);
  const [doublons, setDoublons] = useState<(TicketOuvert & { score: number })[]>([]);
  const [different, setDifferent] = useState(false);
  useEffect(() => {
    if (!ouvert || tickets.current) return;
    tickets.current = [];
    ticketsOuverts(appId).then((t) => (tickets.current = t)).catch(() => undefined);
  }, [ouvert, appId]);
  useEffect(() => {
    if (!ouvert || different) return;
    const t = window.setTimeout(() => setDoublons(doublonsProbables(commentaire, tickets.current ?? [], 0.75)), 350);
    return () => window.clearTimeout(t);
  }, [commentaire, ouvert, different]);
  const soutenirDoublon = async (id: string) => {
    await voter(id);
    setDoublons([]);
    setCommentaire('');
    setEtat('merci');
    setMessage('Merci ! Votre « +1 » fait remonter ce problème : il sera traité en priorité.');
    onOuvrir(false);
  };

  const evolution = donnees.evolutions[appId]?.[0];
  const score = donnees.maturite[appId]?.score;
  const beta = donnees.betas[appId];
  const top = resume?.top ?? [];
  const abVotes = ab ?? resume?.ab;

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (note === null && commentaire.trim().length < 5) {
      setEtat('erreur');
      setMessage('Choisissez une note ou écrivez quelques mots.');
      return;
    }
    if (doublons.length && !different) {
      setEtat('erreur');
      setMessage('Ce point est déjà signalé : ajoutez votre « +1 » ci-dessus, ou dites-nous que c’est autre chose.');
      return;
    }
    if (avisRestants(appId) <= 0) {
      setEtat('erreur');
      setMessage(`Merci ! Vous avez déjà donné ${AVIS_PAR_JOUR} avis aujourd'hui sur ${nom}. Revenez demain.`);
      return;
    }
    setEtat('envoi');
    try {
      await envoyerAvis({
        app_id: appId,
        rating: note,
        category: categorie,
        comment: commentaire.trim(),
        version_tested: version,
        chemin: version === 'beta' && beta ? beta.chemin : chemin,
        site_web: piege,
        ...(urgence !== null ? { source: 'voix' as const, urgence } : {}),
        ...(incident ? { incident_api: { de: incident.de, type: incident.type, statut: incident.statut } } : {}),
      });
      setEtat('merci');
      setMessage('Merci ! Votre avis est enregistré. Il sera lu et, s’il est retenu, l’appli sera améliorée.');
      setNote(null);
      setCommentaire('');
      setUrgence(null);
      setDifferent(false);
      tickets.current = null;
      onMaj();
    } catch (err) {
      setEtat('erreur');
      setMessage(err instanceof Error ? err.message : "L'envoi n'a pas abouti. Réessayez dans un instant.");
    }
  };

  const voter = async (id: string) => {
    if (dejaPlus1(id)) return;
    try {
      const r = await plus1(id);
      setVotes((v) => ({ ...v, [id]: r.upvotes }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Vote impossible pour le moment.');
    }
  };

  const choisirVersion = async (choix: 'actuelle' | 'beta') => {
    if (dejaVoteAb(appId)) return;
    try {
      const r = await voterAb(appId, choix);
      setAb(r.ab);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Vote impossible pour le moment.');
    }
  };

  const etoilesAffichees = survol ?? note ?? 0;
  // Un fournisseur d'IA vient d'échouer (quota, clé, panne) : ce n'est pas un bug de l'appli.
  const incident = ouvert && categorie === 'Bug' ? incidentRecent() : null;

  return (
    <div className="labo">
      {evolution && (
        <p className="labo__evolution">
          <span aria-hidden="true">✨</span> <strong>Dernière évolution IA</strong> · {ilYa(evolution.date)} : {evolution.message}
        </p>
      )}

      {donnees.notes[appId]?.[0]?.technique?.length ? (
        <details className="labo__notes">
          <summary>Notes techniques · {ilYa(donnees.notes[appId][0].date)}</summary>
          <ul>{donnees.notes[appId][0].technique.map((l) => <li key={l}>{l}</li>)}</ul>
        </details>
      ) : null}

      <p className="labo__ligne">
        {resume?.moyenne != null && resume.nb_notes > 0 ? (
          <span className="labo__moyenne" aria-label={`Note moyenne ${resume.moyenne.toLocaleString('fr-FR')} sur 5, ${resume.nb_notes} notes`}>
            <span aria-hidden="true">★</span> {resume.moyenne.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
            <small> /5 · {resume.nb_notes} note{resume.nb_notes > 1 ? 's' : ''}</small>
          </span>
        ) : (
          <span className="labo__moyenne labo__moyenne--vide">Pas encore noté</span>
        )}
        {typeof score === 'number' && <span className="labo__maturite">Maturité {score}/100</span>}
      </p>

      {beta && (
        <div className="labo__beta">
          <a className="labo__bouton labo__bouton--beta" href={beta.chemin}>
            🧪 Tester la nouvelle version générée par l'IA [Version Bêta]
          </a>
          {beta.resume && <p className="labo__petit">{beta.resume}</p>}
          <div className="labo__ab" role="group" aria-label="Quelle version préférez-vous ?">
            <button type="button" className="labo__puce" disabled={dejaVoteAb(appId)} onClick={() => choisirVersion('actuelle')}>
              Je préfère l'actuelle{abVotes ? ` (${abVotes.actuelle})` : ''}
            </button>
            <button type="button" className="labo__puce" disabled={dejaVoteAb(appId)} onClick={() => choisirVersion('beta')}>
              Je préfère la bêta{abVotes ? ` (${abVotes.beta})` : ''}
            </button>
          </div>
        </div>
      )}

      {top.length > 0 && (
        <ul className="labo__top" aria-label={`Demandes en cours pour ${nom}`}>
          {top.slice(0, 3).map((avis) => {
            const deja = dejaPlus1(avis.id);
            return (
              <li key={avis.id}>
                <span className="labo__texte">
                  <span aria-hidden="true">{ICONE[avis.category] ?? '💬'}</span> {avis.comment}
                </span>
                <button
                  type="button"
                  className="labo__plus1"
                  onClick={() => voter(avis.id)}
                  disabled={deja}
                  aria-label={`Je veux ça aussi : ${avis.comment.slice(0, 60)}`}
                  title="Je veux ça aussi !"
                >
                  +1 <small>· {votes[avis.id] ?? avis.upvotes}</small>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {serveurOk ? (
        <button type="button" className="labo__bouton" aria-expanded={ouvert} onClick={() => onOuvrir(!ouvert)}>
          {ouvert ? 'Fermer' : '💬 Donner mon avis'}
        </button>
      ) : (
        <p className="labo__petit">Les avis s'ouvrent bientôt pour cette application.</p>
      )}

      {ouvert && serveurOk && (
        <form className="labo__form" onSubmit={envoyer} noValidate>
          <fieldset className="labo__etoiles" onMouseLeave={() => setSurvol(null)}>
            <legend>Votre note</legend>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={n <= etoilesAffichees ? 'labo__etoile labo__etoile--pleine' : 'labo__etoile'}
                aria-pressed={note === n}
                aria-label={`${n} étoile${n > 1 ? 's' : ''} sur 5`}
                onMouseEnter={() => setSurvol(n)}
                onClick={() => setNote(note === n ? null : n)}
              >
                ★
              </button>
            ))}
          </fieldset>

          <fieldset className="labo__categories">
            <legend>C'est plutôt…</legend>
            {CATEGORIES.map((c) => (
              <label key={c} className={c === categorie ? 'labo__puce labo__puce--choisie' : 'labo__puce'}>
                <input type="radio" name={`cat-${appId}`} value={c} checked={c === categorie} onChange={() => setCategorie(c)} />
                {ICONE[c]} {c}
              </label>
            ))}
          </fieldset>

          <label className="labo__champ">
            <span>Votre commentaire</span>
            <textarea
              value={commentaire}
              onChange={(e) => { setCommentaire(e.target.value); if (!e.target.value) setDifferent(false); }}
              maxLength={1000}
              rows={3}
              placeholder={AIDE[categorie]}
            />
          </label>

          {incident && (
            <p className="labo__message" role="status">
              <strong>Incident API Tiers</strong> : {NOMS_FOURNISSEURS[incident.de]} a refusé ou n'a pas pu répondre il y a peu
              ({incident.type === 'quota' ? 'quota atteint' : incident.type === 'cle_invalide' ? 'clé refusée' : incident.type === 'panne' ? 'panne du fournisseur' : incident.type === 'modele_inconnu' ? 'modèle inconnu' : 'pas de réponse'}).
              Ce n'est pas un bug de l'application : votre message sera classé à part, pas comme un bug.
            </p>
          )}
          <BoutonMicro voix={voix} />
          {urgence !== null && (
            <label className="labo__champ">
              <span>Urgence (estimée d'après votre dictée, à corriger si besoin)</span>
              <select value={urgence} onChange={(e) => setUrgence(Number(e.target.value))}>
                <option value={1}>1 · Simple suggestion</option>
                <option value={2}>2 · Gêne légère</option>
                <option value={3}>3 · Gênant</option>
                <option value={4}>4 · Bloque une fonction</option>
                <option value={5}>5 · Bloque tout ou perte de données</option>
              </select>
            </label>
          )}

          {doublons.length > 0 && !different && (
            <div className="labo__doublons" role="status">
              <p className="labo__petit"><strong>Déjà signalé ?</strong> Ce que vous écrivez ressemble à :</p>
              {doublons.map((d) => (
                <div key={d.id} className="labo__doublon">
                  <p className="labo__texte">{ICONE[d.category] ?? '💬'} {d.comment}</p>
                  <button type="button" className="labo__bouton labo__bouton--envoyer" onClick={() => soutenirDoublon(d.id)} disabled={dejaPlus1(d.id)}>
                    {dejaPlus1(d.id) ? 'Déjà soutenu' : '+1 (J’ai aussi ce problème)'}
                  </button>
                </div>
              ))}
              <button type="button" className="labo__puce" onClick={() => { setDifferent(true); setDoublons([]); }}>
                Non, c'est autre chose
              </button>
            </div>
          )}

          {beta && (
            <label className="labo__champ">
              <span>Version testée</span>
              <select value={version} onChange={(e) => setVersion(e.target.value as 'main' | 'beta')}>
                <option value="main">Version actuelle</option>
                <option value="beta">Version bêta</option>
              </select>
            </label>
          )}

          {/* Piège à robots : invisible pour un humain, laissé vide. */}
          <label className="labo__piege" aria-hidden="true">
            Site web
            <input type="text" tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
          </label>

          <p className="labo__petit">
            Votre avis est public et anonyme. Pour aider à corriger, il emporte la taille de l'écran, le type d'appareil, les
            dernières erreurs techniques de l'appli et le nom de quelques réglages d'affichage. Clés, e-mails, numéros et
            adresses sont effacés avant l'envoi.
          </p>

          <button type="submit" className="labo__bouton labo__bouton--envoyer" disabled={etat === 'envoi'}>
            {etat === 'envoi' ? 'Envoi…' : 'Envoyer mon avis'}
          </button>
        </form>
      )}

      {message && (
        <p className={etat === 'erreur' ? 'labo__message labo__message--erreur' : 'labo__message'} role="status">
          {message}
        </p>
      )}
    </div>
  );
};
