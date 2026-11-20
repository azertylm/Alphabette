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
