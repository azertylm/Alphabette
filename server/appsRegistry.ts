import fs from "fs";
import path from "path";

/**
 * @file appsRegistry.ts
 * Registre central des applications de l'écosystème ALPHABETTE.
 *
 * Source de vérité unique, stockée dans data/apps-registry.json.
 * Ajouter une application ne nécessite aucune modification de code :
 * soit via la console /admin, soit en éditant directement le fichier JSON.
 */

export type AppStatus = "actif" | "brouillon" | "maintenance";
export type AppBadge = "Nouveau" | "Populaire" | null;

export interface RegistryApp {
  id: string;
  name: string;
  slug: string;
  icon: string;
  status: AppStatus;
  badge: AppBadge;
  url?: string;
  createdAt: string;
  updatedAt: string;
}

interface RegistryFile {
  version: number;
  updatedAt: string;
  apps: RegistryApp[];
}

export const APP_STATUSES: AppStatus[] = ["actif", "brouillon", "maintenance"];
export const APP_BADGES: Exclude<AppBadge, null>[] = ["Nouveau", "Populaire"];

const REGISTRY_PATH = path.join(process.cwd(), "data", "apps-registry.json");

const EMPTY_REGISTRY: RegistryFile = {
  version: 1,
  updatedAt: new Date().toISOString(),
  apps: [],
};

/** Normalise un libellé en slug URL (supprime les accents, espaces -> tirets). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function isStatus(value: unknown): value is AppStatus {
  return typeof value === "string" && (APP_STATUSES as string[]).includes(value);
}

function isBadge(value: unknown): value is AppBadge {
  return value === null || (typeof value === "string" && (APP_BADGES as string[]).includes(value));
}

/** Lecture du registre (retourne un registre vide si le fichier est absent). */
export function readRegistry(): RegistryFile {
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<RegistryFile>;
    const apps = Array.isArray(parsed.apps) ? parsed.apps.filter((a) => a && a.id && a.name) : [];
    return {
      version: typeof parsed.version === "number" ? parsed.version : 1,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      apps,
    };
  } catch (err: any) {
    if (err?.code !== "ENOENT") {
      console.error("[REGISTRY] Lecture impossible:", err?.message);
    }
    return { ...EMPTY_REGISTRY };
  }
}

/** Écriture atomique du registre (fichier temporaire puis renommage). */
export function writeRegistry(registry: RegistryFile): RegistryFile {
  const payload: RegistryFile = {
    version: registry.version || 1,
    updatedAt: new Date().toISOString(),
    apps: registry.apps,
  };

  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  const tmpPath = `${REGISTRY_PATH}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  fs.renameSync(tmpPath, REGISTRY_PATH);
  return payload;
}

/** Liste des applications, filtrées éventuellement par statut. */
export function listApps(status?: AppStatus): RegistryApp[] {
  const { apps } = readRegistry();
  const filtered = status ? apps.filter((a) => a.status === status) : apps;
  return [...filtered].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** Les applications publiques visibles sur la vitrine alphabette.fr. */
export function listPublicApps(): RegistryApp[] {
  return listApps("actif");
}

export function getApp(id: string): RegistryApp | undefined {
  return readRegistry().apps.find((a) => a.id === id || a.slug === id);
}

export interface CreateAppInput {
  name?: unknown;
  slug?: unknown;
  icon?: unknown;
  status?: unknown;
  badge?: unknown;
  url?: unknown;
}

export interface UpdateAppInput extends CreateAppInput {}

export class RegistryError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function sanitizeUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const url = value.trim();
  if (url.startsWith("/")) return url;
  if (/^https?:\/\/[^\s]+$/i.test(url)) return url;
  throw new RegistryError("L'URL doit être une adresse http(s) ou un chemin interne (ex: /goat).", 400);
}

function buildUniqueId(registry: RegistryFile, base: string): string {
  const taken = new Set(registry.apps.map((a) => a.id));
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/** Création d'une nouvelle application dans le registre. */
export function createApp(input: CreateAppInput): RegistryApp {
  const registry = readRegistry();

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) throw new RegistryError("Le nom de l'application est obligatoire.", 400);

  const slugSource = typeof input.slug === "string" && input.slug.trim() ? input.slug : name;
  const slug = slugify(slugSource);
  if (!slug) throw new RegistryError("Le slug généré est vide, précisez un slug valide.", 400);
  if (registry.apps.some((a) => a.slug === slug)) {
    throw new RegistryError(`Le slug « ${slug} » est déjà utilisé par une autre application.`, 409);
  }

  if (input.status !== undefined && !isStatus(input.status)) {
    throw new RegistryError("Statut invalide (actif, brouillon ou maintenance).", 400);
  }
  if (input.badge !== undefined && input.badge !== null && input.badge !== "" && !isBadge(input.badge)) {
    throw new RegistryError("Badge invalide (Nouveau, Populaire ou aucun).", 400);
  }

  const now = new Date().toISOString();
  const app: RegistryApp = {
    id: buildUniqueId(registry, slug),
    name,
    slug,
    icon: typeof input.icon === "string" && input.icon.trim() ? input.icon.trim() : "Sparkles",
    status: isStatus(input.status) ? input.status : "brouillon",
    badge: isBadge(input.badge) && input.badge ? input.badge : null,
    url: sanitizeUrl(input.url),
    createdAt: now,
    updatedAt: now,
  };

  registry.apps.push(app);
  writeRegistry(registry);
  return app;
}

/** Mise à jour partielle d'une application (statut, nom, badge, icône, url...). */
export function updateApp(id: string, input: UpdateAppInput): RegistryApp {
  const registry = readRegistry();
  const index = registry.apps.findIndex((a) => a.id === id || a.slug === id);
  if (index === -1) throw new RegistryError("Application introuvable dans le registre.", 404);

  const current = registry.apps[index];
  const next: RegistryApp = { ...current };

  if (input.name !== undefined) {
    if (typeof input.name !== "string" || !input.name.trim()) {
      throw new RegistryError("Le nom de l'application ne peut pas être vide.", 400);
    }
    next.name = input.name.trim();
  }

  if (input.slug !== undefined) {
    const slug = slugify(String(input.slug));
    if (!slug) throw new RegistryError("Slug invalide.", 400);
    const conflict = registry.apps.some((a) => a.slug === slug && a.id !== current.id);
    if (conflict) throw new RegistryError(`Le slug « ${slug} » est déjà utilisé.`, 409);
    next.slug = slug;
  }

  if (input.icon !== undefined) {
    if (typeof input.icon !== "string" || !input.icon.trim()) {
      throw new RegistryError("L'icône ne peut pas être vide.", 400);
    }
    next.icon = input.icon.trim();
  }

  if (input.status !== undefined) {
    if (!isStatus(input.status)) throw new RegistryError("Statut invalide.", 400);
    next.status = input.status;
  }

  if (input.badge !== undefined) {
    if (!isBadge(input.badge) && input.badge !== "") throw new RegistryError("Badge invalide.", 400);
    next.badge = input.badge === "" ? null : (input.badge as AppBadge);
  }

  if (input.url !== undefined) {
    next.url = sanitizeUrl(input.url);
  }

  next.updatedAt = new Date().toISOString();
  registry.apps[index] = next;
  writeRegistry(registry);
  return next;
}

/** Bascule rapide actif <-> masqué (brouillon), utilisée par les boutons 1 clic. */
export function toggleAppVisibility(id: string): RegistryApp {
  const app = getApp(id);
  if (!app) throw new RegistryError("Application introuvable dans le registre.", 404);
  const nextStatus: AppStatus = app.status === "actif" ? "brouillon" : "actif";
  return updateApp(app.id, { status: nextStatus });
}
