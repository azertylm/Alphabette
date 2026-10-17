import { useSyncExternalStore } from 'react';
import { CommunityUser, fetchCommunitySession } from './communityApi';

/**
 * @file communitySession.ts
 * État partagé de la session communauté (compte connecté), consultable depuis
 * n'importe quel composant : en-tête, panneau de partage, galerie.
 */

interface SessionState {
  user: CommunityUser | null;
  /** Faux une fois la première vérification effectuée. */
  isLoading: boolean;
  error: string | null;
}

let state: SessionState = { user: null, isLoading: true, error: null };
let hasLoaded = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

function setState(next: Partial<SessionState>): void {
  state = { ...state, ...next };
  emit();
}

export function subscribeCommunitySession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCommunitySession(): SessionState {
  return state;
}

/** Vérifie auprès du serveur si un compte est connecté (une seule fois). */
export async function refreshCommunitySession(force = false): Promise<CommunityUser | null> {
  if (hasLoaded && !force) return state.user;
  hasLoaded = true;
  try {
    const user = await fetchCommunitySession();
    setState({ user, isLoading: false, error: null });
    return user;
  } catch (err: any) {
    setState({ user: null, isLoading: false, error: err?.message || 'Session indisponible.' });
    return null;
  }
}

/** Met à jour la session après une connexion / inscription. */
export function setCommunityUser(user: CommunityUser | null): void {
  hasLoaded = true;
  setState({ user, isLoading: false, error: null });
}

/** Session communauté réactive. */
export function useCommunitySession(): SessionState {
  return useSyncExternalStore(subscribeCommunitySession, getCommunitySession, getCommunitySession);
}
