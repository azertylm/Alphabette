/**
 * @file pass.ts
 * Pass Découverte 48 h (alphabette.eu) depuis l'accueil du hub. Même format de stockage que la page
 * /pass/ (labo/pages/pass.js) et qu'IA Débat : localStorage « alphabette_decouverte » { jeton, debut, fin },
 * gardé après la fin pour qu'un nouveau clic ne remette jamais le compteur à zéro.
 */

const API = '/api/paiement.php';

export interface PassLocal {
  type: 'pass' | 'decouverte';
  fin: number;
  offre?: string;
  app_nom?: string | null;
}

function lire(cle: string): any {
  try {
    const v = JSON.parse(localStorage.getItem(cle) || 'null');
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

/** Pass actif sur cet appareil : Pass 12 mois d'abord, sinon Pass Découverte. */
export function passActif(): PassLocal | null {
  const now = Date.now();
  const p = lire('alphabette_pass');
  if (p && p.fin > now) return { type: 'pass', fin: p.fin, offre: p.offre, app_nom: p.app_nom };
  const d = lire('alphabette_decouverte');
  if (d && d.fin > now) return { type: 'decouverte', fin: d.fin };
  return null;
}

export function decouverteTerminee(): boolean {
  const d = lire('alphabette_decouverte');
  return Boolean(d && d.fin <= Date.now()) && !passActif();
}

export function decouverteDejaOuverte(): boolean {
  return Boolean(lire('alphabette_decouverte'));
}

export async function decouverteOuverte(): Promise<boolean> {
  try {
    const r = await fetch(`${API}?etat`, { cache: 'no-store' });
    const d = await r.json();
    return Boolean(d?.decouverte?.ouverte);
  } catch {
    return false;
  }
}

export async function lancerDecouverte(): Promise<{ ok: boolean; message?: string }> {
  if (decouverteDejaOuverte()) return { ok: Boolean(passActif()), message: 'Le Pass Découverte a déjà été ouvert sur cet appareil.' };
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'decouverte' }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.jeton) return { ok: false, message: d.erreur || 'Ouverture impossible pour le moment.' };
    localStorage.setItem('alphabette_decouverte', JSON.stringify({ jeton: d.jeton, debut: d.debut, fin: d.fin }));
    return { ok: true };
  } catch {
    return { ok: false, message: 'Pas de connexion : réessayez.' };
  }
}

/** « 47 h 12 min » */
export function tempsRestant(fin: number): string {
  const ms = Math.max(0, fin - Date.now());
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 72) return `${Math.floor(h / 24)} jours`;
  return h >= 1 ? `${h} h ${String(m).padStart(2, '0')} min` : `${Math.max(1, m)} min`;
}
