/**
 * @file collectif.ts
 * Le Collectif Alphabette (alphabette.eu) : soutiens des visiteurs et propositions d'applications.
 * Service : `api/collectif.php` (labo/serveur/), données rangées hors du site.
 */

const API = '/api/collectif.php';
const CLE_SOUTIENS = 'alphabette_soutiens';

export const CATEGORIES_COLLECTIF = ['Quotidien', 'Santé & bien-être', 'Éducation', 'Culture', 'Outils', 'Jeux', 'Citoyen', 'Autre'] as const;

export const CHARTE = [
  'Mon application est utile et fonctionne.',
  "Elle s'utilise tout de suite sur téléphone, sans inscription obligatoire pour la tester.",
  'Elle respecte la vie privée : pas de traceurs publicitaires ni de collecte cachée.',
  "J'accepte de mettre en avant le collectif (badge Alphabette en bas de mon application).",
  "J'ai lu et j'accepte la charte des créateurs (contrôles automatiques, rapport public, signalements).",
] as const;

/** Lien vers la charte complète (dernier point de la liste ci-dessus). */
export const LIEN_CHARTE = '/charte-createurs';

/** Compteurs publics de soutiens, par application. */
export async function chargerSoutiens(): Promise<Record<string, number>> {
  try {
    const r = await fetch(`${API}?soutiens`, { cache: 'no-store' });
    if (!r.ok) return {};
    const d = await r.json();
    return d?.soutiens && typeof d.soutiens === 'object' ? d.soutiens : {};
  } catch {
    return {};
  }
}

/** Ce navigateur a-t-il déjà soutenu cette appli aujourd'hui ? (le serveur vérifie aussi) */
export function dejaSoutenu(appId: string): boolean {
  try {
    const d = JSON.parse(localStorage.getItem(CLE_SOUTIENS) || '{}');
    return d[appId] === new Date().toISOString().slice(0, 10);
  } catch {
    return false;
  }
}

function retenirSoutien(appId: string) {
  try {
    const d = JSON.parse(localStorage.getItem(CLE_SOUTIENS) || '{}');
    d[appId] = new Date().toISOString().slice(0, 10);
    localStorage.setItem(CLE_SOUTIENS, JSON.stringify(d));
  } catch {
    /* stockage indisponible : le serveur limite quand même */
  }
}

export async function soutenir(appId: string): Promise<{ ok: boolean; soutiens?: number; message?: string }> {
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'soutenir', app_id: appId }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { retenirSoutien(appId); return { ok: true, soutiens: d.soutiens }; }
    if (r.status === 409) retenirSoutien(appId);
    return { ok: false, message: d.erreur || 'Soutien impossible pour le moment.' };
  } catch {
    return { ok: false, message: 'Pas de connexion : réessayez.' };
  }
}

export interface Proposition {
  nom: string;
  /** Adresse https de l'appli (vide si elle est hébergée par Alphabette). */
  url: string;
  /** Dépôt GitHub public « pseudo/depot » avec les fichiers construits (appli hébergée et isolée par Alphabette). */
  depot?: string;
  /** Dossier du site dans le dépôt (ex. « dist »), facultatif. */
  dossier?: string;
  description: string;
  categorie: string;
  pseudo: string;
  contact: string;
  charte: boolean[];
  site_web: string; // piège à robots, toujours vide pour un humain
}

export async function proposer(p: Proposition): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'proposer', ...p }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, message: 'Merci ! Votre application est en cours d\'examen. Rien n\'est publié avant validation : réponse sous quelques jours.' };
    return { ok: false, message: d.erreur || 'Envoi impossible pour le moment.' };
  } catch {
    return { ok: false, message: 'Pas de connexion : réessayez.' };
  }
}

export const MOTIFS_SIGNALEMENT = [
  ['illicite', 'Contenu illicite ou dangereux'],
  ['arnaque', 'Arnaque ou hameçonnage'],
  ['donnees', 'Collecte abusive de données personnelles'],
  ['droits', 'Atteinte à mes droits (auteur, image, marque)'],
  ['bug', 'Elle ne marche pas'],
  ['autre', 'Autre'],
] as const;

/** Signalement d'une application (mécanisme de signalement de l'hébergeur : e-mail immédiat à Alphabette). */
export async function signaler(s: { app_id: string; motif: string; details: string; contact: string; site_web: string }): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'signaler', ...s, adresse: window.location.href }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      // Compteur citoyen : 3 signalements d'utilisateurs distincts mettent l'appli en pause (paused_abuse) + alerte admin.
      fetch('/api/upload-guard.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signaler', app_id: s.app_id, motif: s.motif }),
      }).catch(() => {});
      return { ok: true, message: 'Merci : votre signalement est bien parti. Alphabette l\'examine sans délai.' };
    }
    return { ok: false, message: d.erreur || 'Envoi impossible pour le moment.' };
  } catch {
    return { ok: false, message: 'Pas de connexion : réessayez.' };
  }
}

/* ---------- Boîte à idées « Quelle prochaine appli ? » ---------- */

export type Etape = 'nouvelle' | 'discussion' | 'a_explorer' | 'prototype' | 'test_eu' | 'candidate_fr' | 'disponible_fr' | 'pause' | 'refusee' | 'archivee';

export interface PrototypeIdee { app_id: string; testable: boolean; nb_avis: number; moyenne: number | null }

export interface Idee {
  id: string;
  titre: string;
  /** La solution imaginée (ancien champ « une phrase »). */
  phrase: string;
  votes: number;
  date: string;
  /** Posé par les agents ou Valentin (api/labo/idees-statuts.json). */
  statut: 'retenue' | 'realisee' | null;
  probleme?: string | null;
  public_cible?: string | null;
  categorie?: string | null;
  pseudo?: string | null;
  etape?: Etape;
  etape_libelle?: string;
  ferme?: boolean;
  nb_commentaires?: number;
  derniere_activite?: string;
  prototype?: PrototypeIdee | null;
  note_decision?: string | null;
}

export interface CommentaireIdee { id: string; parent: string | null; texte: string; pseudo: string | null; date: string }
export interface AvisPrototype { id: string; valeur: number; commentaire: string; pseudo: string | null; date: string }
export interface EtapeHistorique { vers: Etape; libelle: string; date: string; note: string | null }
export interface DetailIdee { idee: Idee; commentaires: CommentaireIdee[]; avis: AvisPrototype[]; historique: EtapeHistorique[]; fusion_vers?: string }

/** Le parcours d'une idée, dans l'ordre. « En pause », « Refusée » et « Archivée » sont des sorties expliquées en public. */
export const ETAPES: { cle: Etape; libelle: string }[] = [
  { cle: 'nouvelle', libelle: 'Nouvelle idée' },
  { cle: 'discussion', libelle: 'En discussion' },
  { cle: 'a_explorer', libelle: 'À explorer' },
  { cle: 'prototype', libelle: 'Prototype en cours' },
  { cle: 'test_eu', libelle: 'En test sur alphabette.eu' },
  { cle: 'candidate_fr', libelle: 'Candidate pour alphabette.fr' },
  { cle: 'disponible_fr', libelle: 'Disponible sur alphabette.fr' },
  { cle: 'pause', libelle: 'En pause' },
  { cle: 'refusee', libelle: 'Refusée' },
  { cle: 'archivee', libelle: 'Archivée' },
];

export const MOTIFS_CONTENU: { cle: string; libelle: string }[] = [
  { cle: 'spam', libelle: 'Spam ou publicité' },
  { cle: 'insulte', libelle: 'Propos blessants' },
  { cle: 'donnees', libelle: 'Donnée personnelle' },
  { cle: 'hors_sujet', libelle: 'Hors sujet' },
  { cle: 'autre', libelle: 'Autre' },
];

const CLE_JETON = 'alphabette_labo_jeton';

/**
 * Jeton aléatoire propre à cet appareil : il sert seulement à n'autoriser qu'un soutien par idée et un avis par prototype.
 * Le serveur n'en garde qu'une empreinte salée. Vider les données du navigateur le remet à zéro (limite connue).
 */
export function jetonAppareil(): string {
  try {
    const existant = localStorage.getItem(CLE_JETON);
    if (existant && /^[a-f0-9]{32}$/.test(existant)) return existant;
    const o = new Uint8Array(16);
    crypto.getRandomValues(o);
    const j = Array.from(o, (x) => x.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(CLE_JETON, j);
    return j;
  } catch {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
}

const CLE_IDEES = 'alphabette_idees_votees';

export async function chargerIdees(): Promise<Idee[] | null> {
  try {
    const r = await fetch(`${API}?idees=1`, { cache: 'no-store' });
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d?.idees) ? (d.idees as Idee[]) : null;
  } catch {
    return null;
  }
}

/** Idées déjà votées sur cet appareil (une fois pour toutes ; le serveur vérifie aussi). */
export function ideesVotees(): string[] {
  try {
    const l = JSON.parse(localStorage.getItem(CLE_IDEES) || '[]');
    return Array.isArray(l) ? l.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function retenirVoteIdee(id: string) {
  try {
    const l = ideesVotees();
    if (!l.includes(id)) localStorage.setItem(CLE_IDEES, JSON.stringify([...l, id].slice(-500)));
  } catch {
    /* navigation privée : le serveur limite quand même */
  }
}

/** Même filtre que collectif.php (refus_idee), pour répondre tout de suite. '' = l'idée passe. */
export function refusIdee(titre: string, phrase: string): string {
  const t = titre.trim();
  const p = phrase.trim();
  if (t.length < 3 || t.length > 60) return 'Le titre doit faire entre 3 et 60 caractères.';
  if (p.length < 10 || p.length > 160) return 'Décrivez votre idée en une phrase (10 à 160 caractères).';
  return refusContenu(`${t} ${p}`);
}

/** Contrôle du contenu public (liens, e-mail, téléphone, majuscules) : '' = ça passe. Même règle que collectif.php. */
export function refusContenu(tout: string): string {
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|fr|eu|net|org|io|ly|xyz|ru|info)\b/i.test(tout)) return 'Pas de lien dans une idée : décrivez-la simplement.';
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(tout)) return "Pas d'adresse e-mail dans une idée : elle est publique.";
  if (/(?:\d[\s.-]?){8,}/.test(tout)) return 'Pas de numéro de téléphone dans une idée : elle est publique.';
  if (/(.)\1{5,}/u.test(tout)) return 'Le texte contient trop de caractères répétés.';
  const lettres = tout.replace(/[^\p{L}]/gu, '');
  const majuscules = tout.replace(/[^\p{Lu}]/gu, '');
  if (lettres.length >= 12 && majuscules.length > 0.6 * lettres.length) return "Merci d'écrire sans tout en majuscules.";
  return '';
}

export async function proposerIdee(titre: string, phrase: string, site_web: string): Promise<{ ok: boolean; message: string; idee?: Idee }> {
  try {
    const r = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'idee', titre: titre.trim(), phrase: phrase.trim(), site_web }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.idee) {
      retenirVoteIdee(d.idee.id);
      return { ok: true, message: 'Merci ! Votre idée est publiée : faites-la connaître pour qu’elle monte.', idee: d.idee };
    }
    return { ok: false, message: d.erreur || 'Envoi impossible pour le moment.' };
  } catch {
    return { ok: false, message: 'Pas de connexion : réessayez.' };
  }
}

export async function voterIdee(id: string): Promise<{ ok: boolean; votes?: number; message?: string }> {
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'voter_idee', id }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { retenirVoteIdee(id); return { ok: true, votes: d.votes }; }
    if (r.status === 409) retenirVoteIdee(id);
    return { ok: false, message: d.erreur || 'Vote impossible pour le moment.' };
  } catch {
    return { ok: false, message: 'Pas de connexion : réessayez.' };
  }
}

/* ---------- Laboratoire d'Octet : discussion, soutien sans compte, notes de prototype ---------- */

export interface NouvelleIdee { titre: string; probleme: string; phrase: string; public_cible: string; categorie: string; pseudo: string }

/** Mêmes bornes que collectif.php (idée du Laboratoire) : '' = ça passe. */
export function refusIdeeLabo(i: NouvelleIdee): string {
  const t = i.titre.trim(); const p = i.probleme.trim(); const s = i.phrase.trim();
  if (t.length < 5 || t.length > 80) return 'Le titre doit faire entre 5 et 80 caractères.';
  if (p.length < 10 || p.length > 300) return 'Décrivez le problème en 10 à 300 caractères.';
  if (s.length < 10 || s.length > 400) return 'Décrivez la solution en 10 à 400 caractères.';
  return refusContenu(`${t} ${p} ${s} ${i.public_cible}`);
}

async function appeler(corps: Record<string, unknown>): Promise<{ ok: boolean; status: number; d: any }> {
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, d };
  } catch {
    return { ok: false, status: 0, d: { erreur: 'Pas de connexion : réessayez.' } };
  }
}

export async function proposerIdeeLabo(i: NouvelleIdee, site_web: string): Promise<{ ok: boolean; message: string; idee?: Idee }> {
  const r = await appeler({ action: 'idee', titre: i.titre.trim(), probleme: i.probleme.trim(), phrase: i.phrase.trim(), public_cible: i.public_cible.trim(),
    categorie: i.categorie, pseudo: i.pseudo.trim(), jeton: jetonAppareil(), site_web });
  if (r.ok && r.d.idee) { retenirVoteIdee(r.d.idee.id); return { ok: true, message: 'Merci ! Votre idée est publiée tout de suite : elle est visible de tous. Vous pouvez la suivre dans la liste.', idee: r.d.idee }; }
  return { ok: false, message: r.d.erreur || 'Envoi impossible pour le moment.' };
}

export async function soutenirIdee(id: string): Promise<{ ok: boolean; votes?: number; message?: string }> {
  const r = await appeler({ action: 'voter_idee', id, jeton: jetonAppareil() });
  if (r.ok) { retenirVoteIdee(id); return { ok: true, votes: r.d.votes }; }
  if (r.status === 409 && r.d.deja) retenirVoteIdee(id);
  return { ok: false, message: r.d.erreur || 'Soutien impossible pour le moment.' };
}

export async function retirerSoutien(id: string): Promise<{ ok: boolean; votes?: number; message?: string }> {
  const r = await appeler({ action: 'retirer_vote_idee', id, jeton: jetonAppareil() });
  if (r.ok || r.status === 404) {
    try { localStorage.setItem(CLE_IDEES, JSON.stringify(ideesVotees().filter((x) => x !== id))); } catch { /* sans stockage */ }
    return r.ok ? { ok: true, votes: r.d.votes } : { ok: false, message: r.d.erreur };
  }
  return { ok: false, message: r.d.erreur || 'Retrait impossible pour le moment.' };
}

export async function chargerDetailIdee(id: string): Promise<DetailIdee | null> {
  try {
    const r = await fetch(`${API}?idee=${encodeURIComponent(id)}`, { cache: 'no-store' });
    return r.ok ? ((await r.json()) as DetailIdee) : null;
  } catch {
    return null;
  }
}

export async function commenterIdee(id: string, texte: string, pseudo: string, parent: string | null): Promise<{ ok: boolean; message: string; commentaire?: CommentaireIdee }> {
  const r = await appeler({ action: 'commenter', id, texte: texte.trim(), pseudo: pseudo.trim(), parent });
  return r.ok ? { ok: true, message: 'Commentaire publié.', commentaire: r.d.commentaire } : { ok: false, message: r.d.erreur || 'Envoi impossible pour le moment.' };
}

export async function signalerContenu(type: 'idee' | 'commentaire' | 'avis', id: string, motif: string): Promise<boolean> {
  return (await appeler({ action: 'signaler_contenu', type, id, motif })).ok;
}

export async function noterPrototype(id: string, note: number, commentaire: string, pseudo: string, essai: boolean): Promise<{ ok: boolean; message: string; nb_avis?: number; moyenne?: number | null }> {
  const r = await appeler({ action: 'noter_prototype', id, note, commentaire: commentaire.trim(), pseudo: pseudo.trim(), essai, jeton: jetonAppareil() });
  return r.ok ? { ok: true, message: r.d.maj ? 'Votre avis a été mis à jour.' : 'Merci pour votre avis !', nb_avis: r.d.nb_avis, moyenne: r.d.moyenne } : { ok: false, message: r.d.erreur || 'Envoi impossible pour le moment.' };
}

