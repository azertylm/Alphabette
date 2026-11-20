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
  /** Avis écrits encore à traiter (absent sur un ancien feedback.php). */
  file_attente?: number;
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
  /** « voix » si l'avis a été dicté ; urgence 1-5 estimée puis relue par le visiteur. */
  source?: 'formulaire' | 'voix';
  urgence?: number;
  /** Incident d'un fournisseur d'IA (routeur BYOK) constaté juste avant. */
  incident_api?: { de: string; type: string; statut: number | null };
  /** Pseudo facultatif : Tableau d'Honneur si l'avis déclenche une amélioration. */
  pseudo?: string;
}

export async function envoyerAvis(avis: NouvelAvis) {
  const { chemin, ...reste } = avis;
  const res = await envoyer<{ ok: true; id: string }>({ action: 'avis', source: 'formulaire', ...reste, pseudo: reste.pseudo?.trim() || undefined, incident_api: reste.incident_api ? { fournisseur: reste.incident_api.de, type: reste.incident_api.type, statut: reste.incident_api.statut } : undefined, comment: nettoyerTexte(reste.comment, 1000), telemetry: telemetrie(chemin) });
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

export interface EcoScore { note_sobriete: string; poids_transfere_ko: number; ecoindex: { score: number }; accessibilite_seniors: number; audite_le: string }

/** Éco-scores des applis transférées sur alphabette.fr (Agent Gardien). Vide → rien d'affiché. */
export async function chargerEcoScores(): Promise<Record<string, EcoScore>> {
  try {
    const r = await fetch('/api/labo/eco_scores.json', { cache: 'no-store' });
    return ((await r.json()) as { apps?: Record<string, EcoScore> }).apps ?? {};
  } catch {
    return {};
  }
}

export interface CertificatReseau { conforme: boolean; audite_le: string; empreinte: string }

/** Certificats d'Audit Réseau publiés (alphabette.fr/certificats/index.json). Absent → rien d'affiché. */
export async function chargerCertificats(): Promise<Record<string, CertificatReseau>> {
  try {
    const r = await fetch('/certificats/index.json', { cache: 'no-cache' });
    return r.ok ? (((await r.json()) as { apps?: Record<string, CertificatReseau> }).apps ?? {}) : {};
  } catch {
    return {};
  }
}

export interface NoteAtelier { note: number; controle_technique: number; compte: { bloquant: number; important: number; conseil: number }; apte: boolean; date: string }
export interface JuryAtelier { teste_au_labo: boolean; date: string | null; controle_technique: number; raison: string }
export interface DonneesAtelier { apps: Record<string, NoteAtelier>; jury: Record<string, JuryAtelier> }

/** Atelier qualité (alphabette.eu) : notes de la nuit et badges « Testé au Labo ». Absent → rien d'affiché. */
export async function chargerAtelier(): Promise<DonneesAtelier> {
  try {
    const r = await fetch('/api/labo/atelier.json', { cache: 'no-cache' });
    const d = r.ok ? ((await r.json()) as Partial<DonneesAtelier>) : {};
    return { apps: d.apps ?? {}, jury: d.jury ?? {} };
  } catch {
    return { apps: {}, jury: {} };
  }
}

/* ---------- Météo du Labo, Avant / Après, Tableau d'Honneur (alphabette.eu) ---------- */

export interface StatutLabo {
  passage_quotidien?: { heure: string; fuseau: string };
  dernier_passage: { date: string; avis_lus: number | null; corrections: number | null; rejets: number | null } | null;
  sentinelle: { retours_arriere_total: number; interventions: { date: string; app_id: string | null; retour_arriere: boolean }[] };
}

/** status-labo.json (agents de 21 h 13 + Sentinelle). Absent → null : le bandeau n'invente rien. */
export async function chargerStatutLabo(): Promise<StatutLabo | null> {
  try {
    const r = await fetch('/api/labo/status-labo.json', { cache: 'no-cache' });
    if (!r.ok) return null;
    const d = (await r.json()) as Partial<StatutLabo>;
    if (!d.sentinelle || !Array.isArray(d.sentinelle.interventions)) return null;
    return { passage_quotidien: d.passage_quotidien, dernier_passage: d.dernier_passage ?? null, sentinelle: d.sentinelle };
  } catch {
    return null;
  }
}

export interface ChangementLabo { probleme: string; amelioration: string; origine?: string; avis?: string[] }
export interface PassageApp { passage: string; changements: ChangementLabo[] }

/** changelog-labo.json : dernier passage par appli (bouton « Avant / Après »). */
export async function chargerChangelogLabo(): Promise<Record<string, PassageApp>> {
  try {
    const r = await fetch('/api/labo/changelog-labo.json', { cache: 'no-cache' });
    const d = r.ok ? ((await r.json()) as { apps?: Record<string, PassageApp> }) : {};
    const apps: Record<string, PassageApp> = {};
    for (const [id, p] of Object.entries(d.apps ?? {})) {
      const changements = (p?.changements ?? []).filter((c) => c && c.probleme && c.amelioration);
      if (changements.length) apps[id] = { passage: p.passage, changements };
    }
    return apps;
  } catch {
    return {};
  }
}

export interface ContributionHonneur { pseudo: string; app_id: string; avis_id: string; date: string }

/** tableau-honneur.json : une ligne par avis signé et retenu (rempli par scripts/labo/tableau-honneur.mjs). */
export async function chargerTableauHonneur(): Promise<ContributionHonneur[] | null> {
  try {
    const r = await fetch('/api/labo/tableau-honneur.json', { cache: 'no-cache' });
    if (!r.ok) return null;
    const d = (await r.json()) as { contributions?: ContributionHonneur[] };
    return Array.isArray(d.contributions) ? d.contributions : [];
  } catch {
    return null;
  }
}

/** Parties d'une date à l'heure de Paris (année, mois, jour, heure, minute, seconde). */
export function partiesParis(date: Date): Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number> {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(date).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
  return p as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
}

/** Décalage de Paris par rapport à UTC à cet instant, en millisecondes (heure d'été comprise). */
function decalageParis(t: number): number {
  const p = partiesParis(new Date(t));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
}

/** Prochain passage des agents : tous les jours à 21 h 13, heure de Paris (heure d'été / d'hiver gérées). */
export function prochainPassage(maintenant = new Date(), heure = 21, minute = 13): Date {
  const p = partiesParis(maintenant);
  for (let jour = 0; jour < 3; jour++) {
    const murale = Date.UTC(p.year, p.month - 1, p.day + jour, heure, minute, 0);
    let t = murale - decalageParis(murale);
    t = murale - decalageParis(t);
    if (t > maintenant.getTime()) return new Date(t);
  }
  return new Date(maintenant.getTime() + 86400e3);
}

/** Clé « 2026-11 » du mois en cours à Paris. */
export const moisParis = (d = new Date()) => {
  const p = partiesParis(d);
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
};

/** Titre décalé du Tableau d'Honneur selon le nombre de retours validés du mois. */
export function titreHonneur(n: number): { titre: string; icone: string } {
  if (n >= 5) return { titre: 'Dompteur de bugs', icone: '🦁' };
  if (n >= 3) return { titre: 'Voix du labo', icone: '📣' };
  return { titre: 'Œil de lynx', icone: '👁️' };
}
