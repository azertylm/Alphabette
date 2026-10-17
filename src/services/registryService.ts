import { RegistryApp, RegistryAppBadge, RegistryAppStatus } from '../types';

/**
 * @file registryService.ts
 * Client HTTP du registre central des applications (data/apps-registry.json).
 * Les routes /api/admin/* s'appuient sur le cookie de session httpOnly.
 */

export interface RegistryAppsResponse {
  apps: RegistryApp[];
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as { error?: string }).error || `Erreur HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

/** Applications publiées (statut « actif ») — lecture publique. */
export async function fetchPublicApps(): Promise<RegistryApp[]> {
  const response = await fetch('/api/apps', { headers: { Accept: 'application/json' } });
  const data = await parseJson<RegistryAppsResponse>(response);
  return data.apps ?? [];
}

/** Toutes les applications du registre (statuts confondus). */
export async function fetchAdminApps(): Promise<RegistryApp[]> {
  const response = await fetch('/api/admin/apps', { headers: { Accept: 'application/json' } });
  const data = await parseJson<RegistryAppsResponse>(response);
  return data.apps ?? [];
}

export async function checkAdminSession(): Promise<{ authenticated: boolean; configured: boolean }> {
  const response = await fetch('/api/admin/session', { headers: { Accept: 'application/json' } });
  return parseJson<{ authenticated: boolean; configured: boolean }>(response);
}

export async function adminLogin(password: string): Promise<void> {
  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  await parseJson<{ authenticated: boolean }>(response);
}

export async function adminLogout(): Promise<void> {
  await fetch('/api/admin/logout', { method: 'POST' });
}

/** Bascule 1 clic d'une application (actif <-> masqué). */
export async function toggleApp(id: string): Promise<RegistryApp> {
  const response = await fetch(`/api/admin/apps/${encodeURIComponent(id)}/toggle`, { method: 'POST' });
  const data = await parseJson<{ app: RegistryApp }>(response);
  return data.app;
}

export interface RegistryAppInput {
  name: string;
  slug?: string;
  icon?: string;
  status?: RegistryAppStatus;
  badge?: RegistryAppBadge;
  url?: string;
  subdomain?: string;
}

export async function createRegistryApp(input: RegistryAppInput): Promise<RegistryApp> {
  const response = await fetch('/api/admin/apps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ app: RegistryApp }>(response);
  return data.app;
}

export async function updateRegistryApp(id: string, input: Partial<RegistryAppInput>): Promise<RegistryApp> {
  const response = await fetch(`/api/admin/apps/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ app: RegistryApp }>(response);
  return data.app;
}
