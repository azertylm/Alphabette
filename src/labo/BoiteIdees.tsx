import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CATEGORIES_COLLECTIF, ETAPES, MOTIFS_CONTENU, chargerDetailIdee, chargerIdees, commenterIdee, ideesVotees, noterPrototype, proposerIdeeLabo,
  refusIdeeLabo, retirerSoutien, signalerContenu, soutenirIdee, type CommentaireIdee, type DetailIdee, type Etape, type Idee,
} from './collectif';
import { OctetMessage } from '../octet/OctetMessage';
import { OctetHelp } from '../octet/OctetHelp';
import { MESSAGES } from '../octet/messages';

/**
 * @file BoiteIdees.tsx
 * Le Laboratoire d'Octet (alphabette.eu) : l'ancienne boîte « Quelle prochaine appli ? » devenue un parcours communautaire.
 * Proposer une idée, la discuter, la soutenir, tester les prototypes et les noter, suivre son avancement.
 * Sans compte. Même ancre (#idees), même service (api/collectif.php). Le soutien d'une idée n'est PAS une note de qualité
 * et ne déclenche jamais, à lui seul, une publication sur alphabette.fr (décision éditoriale + accord explicite du créateur).
 * La voix, BIG et le mode jour/nuit viennent de la barre commune : rien n'est refait ici.
 */

type Tri = 'soutenues' | 'recentes' | 'actives';
const IMG = '/assets/octet/';
const sansAccent = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const dateCourte = (iso: string) => { try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } };
const pluriel = (n: number, un: string, plus: string) => `${n} ${n > 1 ? plus : un}`;
const auteur = (i: Idee) => (i.pseudo ? i.pseudo : 'contribution anonyme');
const etapeDe = (i: Idee): Etape => i.etape ?? 'nouvelle';
const libelleEtape = (e: Etape) => ETAPES.find((x) => x.cle === e)?.libelle ?? e;

const Octet: React.FC<{ nom: 'arrosoir' | 'loupe' | 'sablier' | 'fiole' | 'cle'; taille?: number }> = ({ nom, taille = 120 }) => (
  // Illustration décorative : l'information est dans le texte voisin (alt vide).
  <img className="octet__img" src={`${IMG}octet-${nom}.webp`} alt="" width={taille} height={taille} loading="lazy" decoding="async" />
);

const Etoiles: React.FC<{ moyenne: number | null; nb: number }> = ({ moyenne, nb }) =>
  moyenne === null ? (
    <span className="octet__note">Pas encore noté · 0 avis</span>
  ) : (
    <span className="octet__note"><span aria-hidden="true">{'★'.repeat(Math.round(moyenne))}{'☆'.repeat(5 - Math.round(moyenne))}</span> {String(moyenne).replace('.', ',')}/5 · {pluriel(nb, 'avis', 'avis')}</span>
  );

/* ---------- Discussion et notes d'une idée ---------- */

const Discussion: React.FC<{ idee: Idee; onChange: (i: Partial<Idee>) => void }> = ({ idee, onChange }) => {
  const [d, setD] = useState<DetailIdee | null | 'chargement'>('chargement');
  const [texte, setTexte] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [reponse, setReponse] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [note, setNote] = useState(0);
  const [avisTexte, setAvisTexte] = useState('');
  const [essai, setEssai] = useState(false);
  const [msgNote, setMsgNote] = useState<{ ok: boolean; t: string } | null>(null);
  const [signale, setSignale] = useState<string | null>(null);

  const recharger = () => chargerDetailIdee(idee.id).then((x) => setD(x));
  useEffect(() => { recharger(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [idee.id]);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await commenterIdee(idee.id, texte, pseudo, reponse);
    setMsg({ ok: r.ok, t: r.message });
    if (r.ok) { setTexte(''); setReponse(null); await recharger(); onChange({ nb_commentaires: (idee.nb_commentaires ?? 0) + 1 }); }
  };
  const envoyerNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (note < 1) { setMsgNote({ ok: false, t: 'Choisissez une note de 1 à 5.' }); return; }
    const r = await noterPrototype(idee.id, note, avisTexte, pseudo, essai);
    setMsgNote({ ok: r.ok, t: r.message });
    if (r.ok && idee.prototype) { onChange({ prototype: { ...idee.prototype, nb_avis: r.nb_avis ?? idee.prototype.nb_avis, moyenne: r.moyenne ?? null } }); await recharger(); }
  };
  const signaler = async (type: 'idee' | 'commentaire' | 'avis', id: string, motif: string) => {
    if (!motif) return;
    const ok = await signalerContenu(type, id, motif);
    setSignale(ok ? id : null);
  };
  const Signaler: React.FC<{ type: 'idee' | 'commentaire' | 'avis'; id: string }> = ({ type, id }) =>
    signale === id ? <span className="labo__petit" role="status">Merci, signalement transmis.</span> : (
      <label className="octet__signaler">
        <span className="octet__signaler-lib">Signaler</span>
        <select aria-label={`Signaler ce contenu : choisir un motif`} defaultValue="" onChange={(e) => signaler(type, id, e.target.value)}>
          <option value="" disabled>Motif…</option>
          {MOTIFS_CONTENU.map((m) => <option key={m.cle} value={m.cle}>{m.libelle}</option>)}
        </select>
      </label>
    );

  if (d === 'chargement') return <div className="octet__etat"><Octet nom="sablier" taille={72} /><p role="status">Chargement de la discussion…</p></div>;
  if (d === null) return <p className="accueil__message" role="alert">La discussion n'a pas pu être chargée. Réessayez dans un instant.</p>;
  if (d.fusion_vers) return <p className="accueil__message">Cette idée a été regroupée avec une autre, plus ancienne : retrouvez-la dans la liste.</p>;

  const racine = d.commentaires.filter((c) => !c.parent);
  const reponses = (id: string) => d.commentaires.filter((c) => c.parent === id);
  const ferme = d.idee.ferme === true;
  const proto = d.idee.prototype;
  const ligne = (c: CommentaireIdee, enfant = false) => (
    <li key={c.id} className={enfant ? 'octet__com octet__com--reponse' : 'octet__com'}>
      <p className="octet__com-tete"><strong>{c.pseudo ?? 'anonyme'}</strong> · <span>{dateCourte(c.date)}</span></p>
      <p className="octet__texte">{c.texte}</p>
      <p className="octet__com-actions">
        {!enfant && !ferme && <button type="button" className="octet__lien" onClick={() => setReponse(c.id)}>Répondre</button>}
        <Signaler type="commentaire" id={c.id} />
      </p>
    </li>
  );

  return (
    <div className="octet__detail">
      {d.idee.probleme && <p><strong>Le problème :</strong> {d.idee.probleme}</p>}
      <p><strong>La solution imaginée :</strong> {d.idee.phrase}</p>
      {d.idee.public_cible && <p><strong>Pour qui :</strong> {d.idee.public_cible}</p>}
      {d.idee.note_decision && <p className="octet__decision"><strong>Note de l'équipe :</strong> {d.idee.note_decision}</p>}
      {d.historique.length > 0 && (
        <details className="octet__histoire"><summary>Historique des étapes ({d.historique.length})</summary>
          <ol>{d.historique.map((h, k) => <li key={k}>{dateCourte(h.date)} · {h.libelle}{h.note ? ` — ${h.note}` : ''}</li>)}</ol>
        </details>
      )}
      <p className="octet__signaler-ligne"><Signaler type="idee" id={idee.id} /></p>

      {proto && (
        <section className="octet__proto" aria-label="Prototype à essayer">
          <h4>Le prototype</h4>
          <p><Etoiles moyenne={proto.moyenne} nb={proto.nb_avis} /></p>
          {proto.testable ? (
            <>
              <OctetMessage message={MESSAGES.conseilPrototype} pose={null} contexte="prototype" />
              <p><a className="labo__bouton" href={`/apps/${encodeURIComponent(proto.app_id)}/`}>Tester le prototype</a></p>
              <p className="labo__petit">Ces notes portent sur un essai réel. Elles sont différentes des soutiens : soutenir une idée dit « j'en ai besoin », noter un prototype dit « j'ai essayé, voilà mon avis ».</p>
              <form className="octet__form-note" onSubmit={envoyerNote} noValidate>
                <fieldset className="octet__etoiles">
                  <legend>Votre note après essai</legend>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n}><input type="radio" name={`note-${idee.id}`} checked={note === n} onChange={() => setNote(n)} /><span aria-hidden="true">{n <= note ? '★' : '☆'}</span><span className="octet__sr">{n} sur 5</span></label>
                  ))}
                </fieldset>
                <label className="labo__champ"><span>Votre expérience (facultatif)</span>
                  <textarea value={avisTexte} onChange={(e) => setAvisTexte(e.target.value)} maxLength={400} rows={2} /></label>
                <label className="mecenes__case"><input type="checkbox" checked={essai} onChange={(e) => setEssai(e.target.checked)} /> J'ai réellement essayé ce prototype.</label>
                <button type="submit" className="labo__bouton">Envoyer mon avis</button>
                {msgNote && <p className={msgNote.ok ? 'labo__message' : 'labo__message labo__message--erreur'} role={msgNote.ok ? 'status' : 'alert'}>{msgNote.t}</p>}
              </form>
              {d.avis.length > 0 && (
                <ul className="octet__liste-avis">
                  {d.avis.filter((a) => a.commentaire).map((a) => (
                    <li key={a.id}><strong>{a.valeur}/5</strong> · {a.pseudo ?? 'anonyme'} — {a.commentaire} <Signaler type="avis" id={a.id} /></li>
                  ))}
                </ul>
              )}
            </>
          ) : <p className="labo__petit">Le prototype n'est pas encore ouvert aux essais.</p>}
        </section>
      )}
      {!proto && <p className="labo__petit">Pas encore de prototype : vous pouvez soutenir l'idée et en discuter. La note en étoiles s'ouvre quand un prototype est testable.</p>}

      <section aria-label="Discussion">
        <h4>Discussion ({pluriel(d.commentaires.length, 'message', 'messages')})</h4>
        {racine.length === 0 && <p className="labo__petit">Pas encore de message : apportez votre précision ou votre cas d'usage.</p>}
        <ul className="octet__fil">
          {racine.map((c) => (
            <React.Fragment key={c.id}>
              {ligne(c)}
              {reponses(c.id).length > 0 && <li className="octet__reponses"><ul>{reponses(c.id).map((r) => ligne(r, true))}</ul></li>}
            </React.Fragment>
          ))}
        </ul>
        {ferme ? <p className="accueil__message">La discussion de cette idée est fermée.</p> : (
          <form onSubmit={envoyer} noValidate className="octet__form-com">
            {reponse && <p className="labo__petit">Vous répondez à un message. <button type="button" className="octet__lien" onClick={() => setReponse(null)}>Annuler</button></p>}
            <OctetMessage message={MESSAGES.conseilDiscussion} pose={null} contexte="discussion" />
            <label className="labo__champ"><span>Votre message <small>texte seul, 500 caractères, sans lien ni coordonnées</small></span>
              <textarea value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={500} rows={3} /></label>
            <label className="labo__champ"><span>Pseudonyme (facultatif)</span>
              <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={24} autoComplete="off" /></label>
            <button type="submit" className="labo__bouton">Publier mon message</button>
            {msg && <p className={msg.ok ? 'labo__message' : 'labo__message labo__message--erreur'} role={msg.ok ? 'status' : 'alert'}>{msg.t}</p>}
          </form>
        )}
        <p className="labo__petit">Les messages restent centrés sur l'application. Les contenus qui ne respectent pas ces règles sont masqués par l'équipe.</p>
      </section>
    </div>
  );
};

/* ---------- Page principale ---------- */

export const BoiteIdees: React.FC = () => {
  const [idees, setIdees] = useState<Idee[] | null | 'chargement'>('chargement');
  const [votees, setVotees] = useState<string[]>(() => ideesVotees());
  const [msgVote, setMsgVote] = useState<{ id: string; texte: string } | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [etape, setEtape] = useState<'toutes' | Etape>('toutes');
  const [tri, setTri] = useState<Tri>('soutenues');
  const [toutes, setToutes] = useState(false);
  const [formOuvert, setFormOuvert] = useState(false);
  const [f, setF] = useState({ titre: '', probleme: '', phrase: '', public_cible: '', categorie: '', pseudo: '' });
  const [decouverteMasquee, setDecouverteMasquee] = useState(false); // simple état de la page : rien n'est stocké
  const [piege, setPiege] = useState('');
  const [etat, setEtat] = useState<'' | 'envoi' | 'ok' | 'erreur'>('');
  const [message, setMessage] = useState('');
  const debut = useRef(Date.now());
  const formRef = useRef<HTMLFormElement>(null);

  const charger = () => { setIdees('chargement'); chargerIdees().then((l) => setIdees(l)); };
  useEffect(charger, []);

  const modifier = (id: string, patch: Partial<Idee>) => setIdees((l) => (Array.isArray(l) ? l.map((x) => (x.id === id ? { ...x, ...patch } : x)) : l));

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    const refus = refusIdeeLabo(f);
    if (refus) { setEtat('erreur'); setMessage(refus); return; }
    if (Date.now() - debut.current < 2500) { setEtat('erreur'); setMessage('Prenez un instant pour relire votre idée avant de l\'envoyer.'); return; }
    setEtat('envoi');
    const r = await proposerIdeeLabo(f, piege);
    setEtat(r.ok ? 'ok' : 'erreur');
    // Le message de réussite n'est affiché que si le serveur a confirmé l'enregistrement ET renvoyé l'idée (visible tout de suite).
    setMessage(r.ok && r.idee ? MESSAGES.succesPublie.texte : r.message);
    if (r.ok && r.idee) {
      const nouvelle = r.idee;
      setIdees((l) => [nouvelle, ...(Array.isArray(l) ? l : [])]);
      setVotees(ideesVotees());
      setF({ titre: '', probleme: '', phrase: '', public_cible: '', categorie: '', pseudo: '' });
    }
  };

  const basculerSoutien = async (i: Idee) => {
    const deja = votees.includes(i.id);
    const r = deja ? await retirerSoutien(i.id) : await soutenirIdee(i.id);
    setVotees(ideesVotees());
    if (r.ok && typeof r.votes === 'number') { modifier(i.id, { votes: r.votes }); setMsgVote({ id: i.id, texte: deja ? 'Soutien retiré.' : 'Soutien enregistré, merci !' }); }
    else setMsgVote({ id: i.id, texte: r.message ?? 'Action impossible pour le moment.' });
  };

  const liste = useMemo(() => {
    if (!Array.isArray(idees)) return [];
    const q = sansAccent(recherche.trim());
    let l = idees.filter((i) => (etape === 'toutes' || etapeDe(i) === etape)
      && (!q || sansAccent(`${i.titre} ${i.phrase} ${i.probleme ?? ''}`).includes(q)));
    l = [...l].sort((a, b) => tri === 'recentes' ? b.date.localeCompare(a.date)
      : tri === 'actives' ? (b.derniere_activite ?? b.date).localeCompare(a.derniere_activite ?? a.date) || (b.nb_commentaires ?? 0) - (a.nb_commentaires ?? 0)
      : b.votes - a.votes || b.date.localeCompare(a.date));
    return l;
  }, [idees, recherche, etape, tri]);
  const visibles = toutes || recherche || etape !== 'toutes' ? liste : liste.slice(0, 10);
  const nbIdees = Array.isArray(idees) ? idees.length : 0;
  // « À découvrir » : seulement un vrai prototype ouvert aux essais (donnée du serveur) ; sinon rien n'est affiché.
  const decouverte = !decouverteMasquee && Array.isArray(idees) ? idees.find((i) => i.prototype?.testable) ?? null : null;

  const ouvrirForm = () => { setFormOuvert(true); setTimeout(() => formRef.current?.querySelector('input')?.focus(), 50); };

  return (
    <section id="idees" className="communaute octet" aria-labelledby="idees-titre">
      <header className="octet__tete">
        <div className="octet__vignette"><Octet nom="arrosoir" taille={132} /></div>
        <div>
          <h2 id="idees-titre" className="accueil__rubrique">Le Laboratoire d'Octet</h2>
          <p className="octet__accroche">{MESSAGES.accueil.titre}</p>
          <p className="communaute__intro">{MESSAGES.accueil.texte}</p>
          <p className="octet__cta">
            <button type="button" className="labo__bouton labo__bouton--envoyer" onClick={ouvrirForm} aria-expanded={formOuvert} aria-controls="octet-form">Proposer une idée</button>
            <a className="labo__bouton" href="#octet-liste">Explorer les idées</a>
            <OctetHelp />
          </p>
        </div>
      </header>

      <details className="octet__guide">
        <summary>Comment ça marche ?</summary>
        <ul>
          <li><strong>Soutenir une idée</strong> signifie « j'en ai besoin ». Les soutiens aident l'équipe à choisir quoi examiner en premier ; ils ne promettent pas de développement.</li>
          <li><strong>Noter un prototype</strong> (de 1 à 5 étoiles) ne se fait qu'après l'avoir réellement essayé. Une simple idée n'a pas de note.</li>
          <li>Le parcours : {ETAPES.slice(0, 7).map((e) => e.libelle).join(' → ')}. Une idée peut aussi être mise en pause, refusée ou archivée, avec une explication.</li>
          <li>{MESSAGES.progression.texte}</li>
          <li><strong>Vers alphabette.fr :</strong> une application peut y être proposée après examen (qualité, sécurité, accessibilité, maintenance) et <strong>accord explicite de son créateur</strong>. Ce n'est jamais automatique, quel que soit le nombre de soutiens.</li>
          <li><strong>Sans compte, sans pub.</strong> Un identifiant aléatoire gardé sur votre appareil évite les doubles soutiens ; vider votre navigateur peut en permettre un nouveau, un plafond quotidien limite les abus. Aucune adresse IP n'est conservée.</li>
        </ul>
      </details>

      <form id="octet-form" ref={formRef} className="labo__form communaute__form" onSubmit={envoyer} noValidate hidden={!formOuvert}>
        <h3>Proposer une idée</h3>
        <OctetMessage message={MESSAGES.conseilFormulaire} pose={null} contexte="formulaire" />
        <label className="labo__champ"><span>Titre de l'idée <small>5 à 80 caractères</small></span>
          <input value={f.titre} onChange={(e) => setF({ ...f, titre: e.target.value })} maxLength={80} placeholder="Ex. : Rappel des poubelles" autoComplete="off" aria-describedby="idee-aide" /></label>
        <label className="labo__champ"><span>Quel problème cette application aiderait-elle à résoudre ? <small>{f.probleme.length}/300</small></span>
          <textarea value={f.probleme} onChange={(e) => setF({ ...f, probleme: e.target.value })} maxLength={300} rows={2} aria-describedby="idee-aide" /></label>
        <label className="labo__champ"><span>Comment imaginez-vous la solution ? <small>{f.phrase.length}/400</small></span>
          <textarea value={f.phrase} onChange={(e) => setF({ ...f, phrase: e.target.value })} maxLength={400} rows={3} aria-describedby="idee-aide" /></label>
        <label className="labo__champ"><span>Pour qui serait-elle utile ? <small>facultatif</small></span>
          <input value={f.public_cible} onChange={(e) => setF({ ...f, public_cible: e.target.value })} maxLength={120} autoComplete="off" /></label>
        <label className="labo__champ"><span>Catégorie <small>facultatif</small></span>
          <select value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value })}>
            <option value="">—</option>{CATEGORIES_COLLECTIF.map((c) => <option key={c}>{c}</option>)}
          </select></label>
        <label className="labo__champ"><span>Pseudonyme <small>facultatif ; sinon « contribution anonyme »</small></span>
          <input value={f.pseudo} onChange={(e) => setF({ ...f, pseudo: e.target.value })} maxLength={24} autoComplete="off" /></label>
        <label className="labo__piege" aria-hidden="true">Ne pas remplir <input tabIndex={-1} value={piege} onChange={(e) => setPiege(e.target.value)} autoComplete="off" /></label>
        <p id="idee-aide" className="labo__petit">
          Votre idée est <strong>publiée tout de suite</strong>, sans compte ni e-mail, et visible de tous. Pas de lien, d'adresse e-mail, de numéro de téléphone ni d'information personnelle ou sensible dans le texte. Les contenus hors sujet sont retirés par l'équipe.
        </p>
        <button type="submit" className="labo__bouton labo__bouton--envoyer" disabled={etat === 'envoi'}>{etat === 'envoi' ? 'Envoi…' : 'Envoyer mon idée'}</button>
        {message && <p className={etat === 'erreur' ? 'labo__message labo__message--erreur' : 'labo__message'} role={etat === 'erreur' ? 'alert' : 'status'}>{message}</p>}
      </form>

      <div id="octet-liste" className="octet__outils" role="search">
        <label className="labo__champ"><span>Rechercher</span>
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Un mot du titre ou de la description" autoComplete="off" /></label>
        <label className="labo__champ"><span>Étape</span>
          <select value={etape} onChange={(e) => setEtape(e.target.value as 'toutes' | Etape)}>
            <option value="toutes">Toutes</option>{ETAPES.map((x) => <option key={x.cle} value={x.cle}>{x.libelle}</option>)}
          </select></label>
        <label className="labo__champ"><span>Trier par</span>
          <select value={tri} onChange={(e) => setTri(e.target.value as Tri)}>
            <option value="soutenues">Plus soutenues</option><option value="recentes">Plus récentes</option><option value="actives">Discussion active</option>
          </select></label>
      </div>

      {idees === 'chargement' && <OctetMessage message={MESSAGES.chargement} live contexte="liste" taille={72} />}
      {idees === null && <div className="octet__etat"><p className="accueil__message" role="alert">Les idées n'ont pas pu être chargées.</p><button type="button" className="labo__bouton" onClick={charger}>Réessayer</button></div>}
      {Array.isArray(idees) && nbIdees === 0 && <OctetMessage message={MESSAGES.videAucune} contexte="liste-vide" />}
      {Array.isArray(idees) && nbIdees > 0 && liste.length === 0 && <OctetMessage message={MESSAGES.videFiltre} live contexte="liste-filtre" />}
      {decouverte && (
        <OctetMessage variante="tip" pose={null} contexte="a-decouvrir" titre="À découvrir" onFermer={() => setDecouverteMasquee(true)}
          texte={`Un prototype est ouvert aux essais : « ${decouverte.titre} ». Vous pouvez l'essayer, puis donner votre avis.`}>
          <button type="button" className="labo__bouton" onClick={() => { setOuverte(decouverte.id); setTimeout(() => document.getElementById(`detail-${decouverte.id}`)?.scrollIntoView({ block: 'nearest' }), 50); }}>Voir ce prototype</button>
        </OctetMessage>
      )}

      {visibles.length > 0 && (
        <ol className="idees octet__liste" aria-label="Idées proposées">
          {visibles.map((i) => {
            const deja = votees.includes(i.id);
            const e = etapeDe(i);
            const est = ouverte === i.id;
            return (
              <li key={i.id} className="idees__idee octet__carte">
                <div className="idees__texte">
                  <strong>{i.titre}</strong>
                  <span className={`collectif-statut${e === 'disponible_fr' ? ' collectif-statut--validee' : ''}`}>{libelleEtape(e)}</span>
                  <span>{i.phrase}</span>
                  <span className="labo__petit">
                    Par {auteur(i)} · {dateCourte(i.date)} · {pluriel(i.nb_commentaires ?? 0, 'commentaire', 'commentaires')}
                    {i.derniere_activite && i.derniere_activite !== i.date ? ` · dernière activité ${dateCourte(i.derniere_activite)}` : ''}
                    {i.statut === 'retenue' ? ' · ★ Retenue par le Labo' : ''}
                  </span>
                  {i.prototype && <Etoiles moyenne={i.prototype.moyenne} nb={i.prototype.nb_avis} />}
                  {msgVote?.id === i.id && <span className="labo__petit" role="status">{msgVote.texte}</span>}
                </div>
                <div className="octet__actions">
                  <p className="octet__votes"><strong>{i.votes}</strong> <span>{i.votes > 1 ? 'personnes soutiennent' : 'personne soutient'}</span></p>
                  <button type="button" className={`labo__bouton${deja ? ' octet__soutenu' : ''}`} aria-pressed={deja} onClick={() => basculerSoutien(i)}>
                    {deja ? '✓ Je soutiens (retirer)' : 'Soutenir cette idée'}
                  </button>
                  <button type="button" className="labo__bouton" aria-expanded={est} aria-controls={`detail-${i.id}`} onClick={() => setOuverte(est ? null : i.id)}>
                    {est ? 'Fermer la discussion' : 'Discussion et détails'}
                  </button>
                </div>
                {est && <div id={`detail-${i.id}`} className="octet__panneau"><Discussion idee={i} onChange={(p) => modifier(i.id, p)} /></div>}
              </li>
            );
          })}
        </ol>
      )}
      {!toutes && !recherche && etape === 'toutes' && liste.length > 10 && (
        <button type="button" className="labo__bouton" onClick={() => setToutes(true)}>Voir les {liste.length} idées</button>
      )}
      {toutes && liste.length > 10 && <button type="button" className="labo__bouton" onClick={() => setToutes(false)}>Voir seulement les 10 premières</button>}
    </section>
  );
};
