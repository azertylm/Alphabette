/**
 * @file communityAdminService.ts
 * Client HTTP de modération de la communauté (console /admin) :
 * pyramides partagées et comptes utilisateurs.
 */

export interface AdminCommunityPyramid {
  id: string;
  title: string;
  authorName: string;
  userId: string;
  sport: string;
  sportLabel: string;
  controversy: number;
  likeCount: number;
  filled: number;
  total: number;
  hidden: boolean;
  createdAt: string;
  imageUrl: string;
}

export interface AdminCommunityUser {
  id: string;
  username: string;
  createdAt: string;
  banned: boolean;
  pyramidCount: number;
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as { error?: string }).error || `Erreur HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export async function fetchAdminCommunityPyramids(): Promise<AdminCommunityPyramid[]> {
  const response = await fetch('/api/admin/community/pyramids', { headers: { Accept: 'application/json' } });
  const data = await parseJson<{ pyramids: AdminCommunityPyramid[] }>(response);
  return data.pyramids ?? [];
}

export async function setAdminPyramidHidden(id: string, hidden: boolean): Promise<void> {
  const response = await fetch(`/api/admin/community/pyramids/${encodeURIComponent(id)}/hide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hidden }),
  });
  await parseJson<{ success: boolean }>(response);
}

export async function deleteAdminPyramid(id: string): Promise<void> {
  const response = await fetch(`/api/admin/community/pyramids/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await parseJson<{ success: boolean }>(response);
}

export async function fetchAdminCommunityUsers(): Promise<AdminCommunityUser[]> {
  const response = await fetch('/api/admin/community/users', { headers: { Accept: 'application/json' } });
  const data = await parseJson<{ users: AdminCommunityUser[] }>(response);
  return data.users ?? [];
}

export async function setAdminUserBanned(id: string, banned: boolean): Promise<void> {
  const response = await fetch(`/api/admin/community/users/${encodeURIComponent(id)}/ban`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ banned }),
  });
  await parseJson<{ success: boolean }>(response);
}
