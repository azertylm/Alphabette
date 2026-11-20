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
    if (r.ok) return { ok: true, message: 'Merci : votre signalement est bien parti. Alphabette l\'examine sans délai.' };
    return { ok: false, message: d.erreur || 'Envoi impossible pour le moment.' };
  } catch {
    return { ok: false, message: 'Pas de connexion : réessayez.' };
  }
}

/* ---------- Boîte à idées « Quelle prochaine appli ? » ---------- */

export interface Idee {
  id: string;
  titre: string;
  phrase: string;
  votes: number;
  date: string;
  /** Posé par les agents ou Valentin (api/labo/idees-statuts.json). */
  statut: 'retenue' | 'realisee' | null;
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
  const tout = `${t} ${p}`;
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
