/**
 * @file appRoutes.ts
 * Carte des applications de l'écosystème alphabette.fr.
 *
 * Règle du jeu (décidée avec le créateur du projet) :
 *  - chaque application vit dans son propre dossier (ex. src/goat) ;
 *  - elle est joignable par un SOUS-DOMAINE dédié
 *    (goatchevretheking.alphabette.fr) ET par un CHEMIN sur le domaine
 *    principal (alphabette.fr/goat) ;
 *  - les deux adresses servent exactement la même application.
 *
 * Ajouter une application = ajouter une entrée ici + son composant dans
 * main.tsx. Rien d'autre : le DNS (wildcard) et le certificat TLS couvrent
 * automatiquement tous les futurs sous-domaines.
 */

export interface AppRouteDefinition {
  /** Identifiant technique, aussi utilisé par l'aperçu `?app=<clé>`. */
  key: string;
  /** Nom lisible de l'application. */
  label: string;
  /** Sous-domaines qui servent l'application (sans le domaine racine). */
  subdomains: string[];
  /** Chemins sur le domaine principal. Le premier sert de base au sous-domaine. */
  paths: string[];
  /** Sous-pages gérées par l'application (ex. /goat/communaute). */
  childPaths?: string[];
}

export const APP_ROUTES: AppRouteDefinition[] = [
  {
    key: 'goat',
    label: 'Goat Chèvre The King',
    subdomains: ['goatchevretheking', 'goat'],
    paths: ['/goat'],
    childPaths: ['/goat/communaute'],
  },
];

/** Sous-domaine d'un hôte : « goatchevretheking.alphabette.fr » → « goatchevretheking ». */
export function subdomainOf(hostname: string): string | null {
  const clean = (hostname || '').toLowerCase().replace(/^www\./, '');
  const parts = clean.split('.');
  // alphabette.fr (2), localhost (1) ou une adresse IP n'ont pas de sous-domaine.
  if (parts.length < 3) return null;
  if (/^\d+$/.test(parts[0])) return null;
  return parts[0];
}

/** Application servie par un sous-domaine, ou null. */
export function findAppBySubdomain(hostname: string): AppRouteDefinition | null {
  const subdomain = subdomainOf(hostname);
  if (!subdomain) return null;
  return APP_ROUTES.find((app) => app.subdomains.includes(subdomain)) ?? null;
}

/**
 * Aperçu local : `?app=goat` simule le sous-domaine sans toucher au DNS.
 * Pratique pour tester une application avant sa mise en ligne.
 */
export function findAppFromSearch(search: string): AppRouteDefinition | null {
  const key = new URLSearchParams(search || '').get('app');
  if (!key) return null;
  return APP_ROUTES.find((app) => app.key === key) ?? null;
}

/**
 * Chemin « effectif » utilisé pour le routage.
 * Sur un sous-domaine, le chemin de base de l'application est ajouté :
 *   goatchevretheking.alphabette.fr         → /goat
 *   goatchevretheking.alphabette.fr/communaute → /goat/communaute
 */
export function resolveEffectivePath(hostname: string, pathname: string, search = ''): string {
  const app = findAppBySubdomain(hostname) ?? findAppFromSearch(search);
  const cleaned = pathname.replace(/\/+$/, '') || '/';
  if (!app) return cleaned;

  const base = app.paths[0] ?? '/';
  if (cleaned === base || cleaned.startsWith(`${base}/`)) return cleaned;
  return `${base}${cleaned === '/' ? '' : cleaned}`;
}

/** Adresse publique recommandée pour une application (sous-domaine). */
export function publicUrlFor(app: AppRouteDefinition, rootDomain = 'alphabette.fr'): string {
  const subdomain = app.subdomains[0];
  return subdomain ? `https://${subdomain}.${rootDomain}` : `https://${rootDomain}${app.paths[0] ?? ''}`;
}
