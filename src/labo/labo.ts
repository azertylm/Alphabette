/**
 * @file labo.ts
 * Le Laboratoire alphabette.eu : même vitrine que alphabette.fr, avec sous chaque
 * application un module d'avis (note, catégorie, commentaire, +1, bêta).
 *
 * Les avis sont enregistrés par `api/feedback.php` (publié dans eu/api/, voir
 * labo/serveur/). Les fichiers `api/labo/*.json` sont écrits par les agents du
 * laboratoire (RULES_AND_MEMORY.md) : décisions, évolutions, maturité, bêtas.
 */

import { cheminCourant, contexteTechnique, nettoyerTexte } from '@alphabette/shell';

/** Vrai sur alphabette.eu (ou avec ?labo pour un essai en local). */
export const MODE_LABO =
  typeof window !== 'undefined' &&
  (/(^|\.)alphabette\.eu$/i.test(window.location.hostname) || new URLSearchParams(window.location.search).has('labo'));

export type Categorie = 'Bug' | 'Idée' | 'Design' | 'Autre';
export const CATEGORIES: Categorie[] = ['Bug', 'Idée', 'Design', 'Autre'];

export interface AvisPublic {
  id: string;
  category: Categorie;
  comment: string;
  upvotes: number;
  timestamp: string;
  status: string;
  version_tested?: string;
}

export interface ResumeApp {
  moyenne: number | null;
  nb_notes: number;
  nb_avis: number;
  top: AvisPublic[];
  ab?: { actuelle: number; beta: number };
}

export interface Resumes {
  apps: Record<string, ResumeApp>;
}

export interface Evolution {
  date: string;
  message: string;
}

export interface NoteVersion {
  date: string;
  technique: string[];
  citoyenne: string[];
}

export interface DonneesLabo {
  evolutions: Record<string, Evolution[]>;
  notes: Record<string, NoteVersion[]>;
  maturite: Record<string, { score: number | null }>;
  betas: Record<string, { chemin: string; resume?: string; depuis?: string }>;
}

const API = '/api/feedback.php';

async function lireJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { erreur?: string }).erreur || `Erreur ${r.status}`);
  return data as T;
}

export const chargerResumes = () => lireJson<Resumes>(API);

/** Fichiers publiés par les agents : absents ou vides, le module n'affiche rien (aucun faux contenu). */
export async function chargerDonneesLabo(): Promise<DonneesLabo> {
  const lire = (nom: string) => lireJson<{ apps?: Record<string, unknown> }>(`/api/labo/${nom}.json`).catch(() => ({ apps: {} }));
  const [evolutions, maturite, betas, notes] = await Promise.all([lire('changelog_summary'), lire('maturity_index'), lire('beta'), lire('notes_version')]);
  return {
    evolutions: (evolutions.apps ?? {}) as DonneesLabo['evolutions'],
    notes: (notes.apps ?? {}) as DonneesLabo['notes'],
    maturite: (maturite.apps ?? {}) as DonneesLabo['maturite'],
    betas: (betas.apps ?? {}) as DonneesLabo['betas'],
  };
}

async function envoyer<T>(corps: Record<string, unknown>): Promise<T> {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(corps),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { erreur?: string }).erreur || `Erreur ${r.status}`);
  return data as T;
}

/* ---------- Limites locales (anti-spam léger, sans compte) ---------- */

const CLE_LIMITES = 'labo_limites_v1';
interface Limites {
  jour: string;
  avis: Record<string, number>;
  plus1: string[];
  ab: string[];
}
const aujourdhui = () => new Date().toISOString().slice(0, 10);

function lireLimites(): Limites {
  try {
    const l = JSON.parse(localStorage.getItem(CLE_LIMITES) || 'null') as Limites | null;
    if (l && l.jour === aujourdhui()) return { jour: l.jour, avis: l.avis ?? {}, plus1: l.plus1 ?? [], ab: l.ab ?? [] };
    // Nouveau jour : on garde les +1 et les votes bêta (une fois pour toutes), on remet les avis à zéro.
    return { jour: aujourdhui(), avis: {}, plus1: l?.plus1 ?? [], ab: l?.ab ?? [] };
  } catch {
    return { jour: aujourdhui(), avis: {}, plus1: [], ab: [] };
  }
}
function ecrireLimites(l: Limites) {
  try {
    localStorage.setItem(CLE_LIMITES, JSON.stringify(l));
  } catch {
    /* navigation privée : tant pis, le serveur limite aussi */
  }
}

export const AVIS_PAR_JOUR = 3;
export const avisRestants = (appId: string) => AVIS_PAR_JOUR - (lireLimites().avis[appId] ?? 0);
export const dejaPlus1 = (id: string) => lireLimites().plus1.includes(id);
export const dejaVoteAb = (appId: string) => lireLimites().ab.includes(appId);

/* ---------- Contexte technique (télémétrie silencieuse) ---------- */

/** Contexte technique et nettoyage : base commune (filtre zéro connaissance), voir packages/shell/src/labo/. */
export { nettoyerTexte as nettoyer, plateformeSimple as plateforme } from '@alphabette/shell';
export const telemetrie = (chemin: string) => contexteTechnique(chemin);

/** Chemin d'une application sur .eu (« /apps/bonplan/ », « /wikicom/ ») : clé des erreurs capturées. */
export function cheminApp(url?: string): string {
  if (!url) return '';
  try {
    return cheminCourant(new URL(url, window.location.origin).pathname);
  } catch {
    return '';
  }
}

/* ---------- Actions ---------- */

export interface NouvelAvis {
  app_id: string;
  rating: number | null;
  category: Categorie;
  comment: string;
  version_tested: 'main' | 'beta';
  chemin: string;
  /** Champ piège invisible : un humain le laisse vide. */
  site_web: string;
}

export async function envoyerAvis(avis: NouvelAvis) {
  const { chemin, ...reste } = avis;
  const res = await envoyer<{ ok: true; id: string }>({ action: 'avis', ...reste, source: 'formulaire', comment: nettoyerTexte(reste.comment, 1000), telemetry: telemetrie(chemin) });
  const l = lireLimites();
  l.avis[avis.app_id] = (l.avis[avis.app_id] ?? 0) + 1;
  ecrireLimites(l);
  return res;
}

export async function plus1(id: string) {
  const res = await envoyer<{ ok: true; upvotes: number }>({ action: 'plus1', id });
  const l = lireLimites();
  if (!l.plus1.includes(id)) l.plus1.push(id);
  ecrireLimites(l);
  return res;
}

export async function voterAb(appId: string, choix: 'actuelle' | 'beta') {
  const res = await envoyer<{ ok: true; ab: { actuelle: number; beta: number } }>({ action: 'ab', app_id: appId, choix });
  const l = lireLimites();
  if (!l.ab.includes(appId)) l.ab.push(appId);
  ecrireLimites(l);
  return res;
}

/** « il y a 2 h », « il y a 3 jours » */
export function ilYa(date: string): string {
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 3600) return `il y a ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  const j = Math.round(s / 86400);
  return j < 31 ? `il y a ${j} jour${j > 1 ? 's' : ''}` : `le ${new Date(t).toLocaleDateString('fr-FR')}`;
}

/** Notes de version « citoyennes » pour la vitrine .fr (vides tant qu'aucune mise à jour n'est passée). */
export async function chargerNotesCitoyennes(): Promise<Record<string, NoteVersion[]>> {
  try {
    const r = await fetch('/api/labo/notes_version.json', { cache: 'no-store' });
    return ((await r.json()) as { apps?: Record<string, NoteVersion[]> }).apps ?? {};
  } catch {
    return {};
  }
}
