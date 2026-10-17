import { useSyncExternalStore, type CSSProperties } from 'react';

/**
 * @file photoFrames.ts
 * Cadrage des photos de joueurs, mémorisé dans le navigateur (localStorage).
 *
 * Par défaut, la photo est affichée **en entier** (`contain`) : aucune partie de
 * l'image n'est coupée. Si le joueur préfère un cadrage plus serré (visage, buste),
 * il peut déplacer et zoomer la photo ; ce cadrage est alors conservé (`crop`) et
 * appliqué partout : réserve, pyramide et image de partage.
 *
 * Le cadrage est stocké en coordonnées normalisées pour rester identique quelles
 * que soient les dimensions de la vignette (petite carte, grande carte, canvas HD).
 */

export type PhotoFrameMode = 'contain' | 'crop';

export interface PhotoFrame {
  /** `contain` = image entière visible ; `crop` = cadrage personnalisé (zoom + décalage). */
  mode: PhotoFrameMode;
  /** Zoom appliqué (1 = échelle de base « cover »). */
  zoom: number;
  /** Décalage horizontal normalisé : -1 = bord gauche, 0 = centré, 1 = bord droit. */
  x: number;
  /** Décalage vertical normalisé : -1 = bord haut, 0 = centré, 1 = bord bas. */
  y: number;
}

/** Cadrage par défaut : image entière, sans déformation ni recadrage. */
export const DEFAULT_FRAME: PhotoFrame = { mode: 'contain', zoom: 1, x: 0, y: 0 };

/** Préréglages proposés dans l'éditeur. */
export const FRAME_PRESETS: Array<{ id: string; label: string; frame: PhotoFrame }> = [
  { id: 'full', label: 'Image entière', frame: { ...DEFAULT_FRAME } },
  { id: 'face', label: 'Visage', frame: { mode: 'crop', zoom: 1.6, x: 0, y: -0.85 } },
  { id: 'bust', label: 'Buste', frame: { mode: 'crop', zoom: 1.25, x: 0, y: -0.6 } },
  { id: 'center', label: 'Centré', frame: { mode: 'crop', zoom: 1.3, x: 0, y: 0 } },
];

const STORAGE_KEY = 'goat_photo_frames_v1';
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

type FrameMap = Record<string, PhotoFrame>;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Nettoie un cadrage venu d'un stockage ou d'un formulaire. */
export function normalizeFrame(frame: PhotoFrame): PhotoFrame {
  return {
    mode: frame.mode === 'crop' ? 'crop' : 'contain',
    zoom: clamp(Number.isFinite(frame.zoom) ? frame.zoom : 1, MIN_ZOOM, MAX_ZOOM),
    x: clamp(Number.isFinite(frame.x) ? frame.x : 0, -1, 1),
    y: clamp(Number.isFinite(frame.y) ? frame.y : 0, -1, 1),
  };
}

const readStorage = (): FrameMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FrameMap;
    const clean: FrameMap = {};
    for (const [id, frame] of Object.entries(parsed)) {
      if (frame && typeof frame === 'object') clean[id] = normalizeFrame(frame as PhotoFrame);
    }
    return clean;
  } catch {
    return {};
  }
};

let frames: FrameMap = readStorage();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const persist = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(frames));
  } catch {
    /* stockage indisponible (navigation privée) : le cadrage reste en mémoire */
  }
};

/** Abonnement pour `useSyncExternalStore`. */
export function subscribePhotoFrames(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Photo instantané courant (identité stable tant qu'aucune modification n'a lieu). */
export function getPhotoFrames(): FrameMap {
  return frames;
}

/** Cadrage enregistré pour un joueur (ou `null` si l'image est affichée en entier). */
export function getPhotoFrame(playerId: string): PhotoFrame | null {
  return frames[playerId] ?? null;
}

/** Enregistre le cadrage d'un joueur. */
export function savePhotoFrame(playerId: string, frame: PhotoFrame): void {
  frames = { ...frames, [playerId]: normalizeFrame(frame) };
  persist();
  emit();
}

/** Supprime le cadrage d'un joueur (retour à l'image entière). */
export function clearPhotoFrame(playerId: string): void {
  if (!frames[playerId]) return;
  const next = { ...frames };
  delete next[playerId];
  frames = next;
  persist();
  emit();
}

/** Réinitialise tous les cadrages (bouton de la pyramide). */
export function clearAllPhotoFrames(): void {
  frames = {};
  persist();
  emit();
}

/** Cadrage d'un joueur, re-rendu automatiquement à chaque modification. */
export function usePhotoFrame(playerId: string | null | undefined): PhotoFrame | null {
  const all = useSyncExternalStore(subscribePhotoFrames, getPhotoFrames, getPhotoFrames);
  if (!playerId) return null;
  return all[playerId] ?? null;
}

/** Styles CSS équivalents au cadrage (utilisés par les vignettes). */
export function frameImageStyle(frame: PhotoFrame | null): CSSProperties {
  if (!frame || frame.mode !== 'crop') {
    return { objectFit: 'contain', objectPosition: 'center' };
  }
  return {
    objectFit: 'cover',
    objectPosition: `${((frame.x + 1) / 2) * 100}% ${((frame.y + 1) / 2) * 100}%`,
    transform: `scale(${frame.zoom})`,
  };
}

export interface PhotoDrawRect {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/**
 * Rectangle de destination du dessin d'une photo dans un cadre donné.
 * Reproduit exactement le rendu CSS (`object-fit` + `object-position` + zoom)
 * afin que l'image de partage soit identique à l'écran.
 */
export function computePhotoDrawRect(
  imageWidth: number,
  imageHeight: number,
  boxX: number,
  boxY: number,
  boxWidth: number,
  boxHeight: number,
  frame: PhotoFrame | null,
): PhotoDrawRect {
  if (imageWidth <= 0 || imageHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    return { dx: boxX, dy: boxY, dw: boxWidth, dh: boxHeight };
  }

  const active = frame ? normalizeFrame(frame) : DEFAULT_FRAME;

  if (active.mode !== 'crop') {
    // Image entière, centrée (aucun recadrage).
    const ratio = Math.min(boxWidth / imageWidth, boxHeight / imageHeight);
    const dw = imageWidth * ratio;
    const dh = imageHeight * ratio;
    return { dx: boxX + (boxWidth - dw) / 2, dy: boxY + (boxHeight - dh) / 2, dw, dh };
  }

  const coverScale = Math.max(boxWidth / imageWidth, boxHeight / imageHeight);
  const baseWidth = imageWidth * coverScale;
  const baseHeight = imageHeight * coverScale;
  const px = (active.x + 1) / 2;
  const py = (active.y + 1) / 2;
  const baseX = boxX - (baseWidth - boxWidth) * px;
  const baseY = boxY - (baseHeight - boxHeight) * py;

  // Zoom autour du centre du cadre (equivalent de `transform: scale()` en CSS).
  const centerX = boxX + boxWidth / 2;
  const centerY = boxY + boxHeight / 2;
  return {
    dx: centerX + (baseX - centerX) * active.zoom,
    dy: centerY + (baseY - centerY) * active.zoom,
    dw: baseWidth * active.zoom,
    dh: baseHeight * active.zoom,
  };
}

/** Vrai si le joueur a un cadrage personnalisé enregistré. */
export function hasCustomFrame(playerId: string): boolean {
  const frame = frames[playerId];
  return Boolean(frame && frame.mode === 'crop');
}
