import fs from "fs";
import path from "path";
import express, { Router, type NextFunction, type Request, type Response } from "express";
import { findAppByHost, getApp, listApps, type RegistryApp } from "./appsRegistry";

/**
 * @file appsHosting.ts
 * Hébergement des applications directement dans le hub alphabette.fr.
 *
 *   apps/<slug>/            fichiers construits de l'application (index.html…)
 *   /apps                   liste des applications actives
 *   /apps/<slug>/…          l'application, chargée depuis le registre
 *   <domaine dédié>/…       la même application servie à la racine
 *                           (ex. lidarsol.fr → /apps/lidarsol/), sans copie de code
 *
 * Une application absente, inactive ou pas encore déposée affiche
 * « Bientôt disponible » : jamais de 404.
 */

const APPS_DIR = path.join(process.cwd(), "apps");
const VISITS_PATH = path.join(process.cwd(), "data", "visits.json");

// --- Compteur de visites (une visite = un chargement de la page d'accueil de l'appli) ---

let visits: Record<string, number> | null = null;
let flushTimer: NodeJS.Timeout | null = null;

function loadVisits(): Record<string, number> {
  if (visits) return visits;
  try {
    visits = JSON.parse(fs.readFileSync(VISITS_PATH, "utf-8")) as Record<string, number>;
  } catch {
    visits = {};
  }
  return visits;
}

function countVisit(slug: string): void {
  const all = loadVisits();
  all[slug] = (all[slug] || 0) + 1;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      fs.mkdirSync(path.dirname(VISITS_PATH), { recursive: true });
      fs.writeFileSync(VISITS_PATH, `${JSON.stringify(all, null, 2)}\n`, "utf-8");
    } catch (err: any) {
      console.error("[VISITS] Écriture impossible:", err?.message);
    }
  }, 2000);
}

export function getVisits(): Record<string, number> {
  return { ...loadVisits() };
}

// --- Pages générées ---

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · Alphabette</title>
<style>
  :root { color-scheme: light dark; --bg:#f8fafc; --fg:#0f172a; --muted:#64748b; --card:#fff; --line:#e2e8f0; --accent:#2563eb; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0b1120; --fg:#f1f5f9; --muted:#94a3b8; --card:#111827; --line:#1f2937; --accent:#60a5fa; } }
  * { box-sizing: border-box; }
  body { margin:0; font:16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; background:var(--bg); color:var(--fg); }
  main { max-width: 960px; margin: 0 auto; padding: 48px 16px; }
  h1 { font-size: 2rem; margin: 0 0 8px; }
  p { color: var(--muted); margin: 0 0 24px; }
  a { color: var(--accent); }
  .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:16px; }
  .card { display:block; padding:20px; border:1px solid var(--line); border-radius:16px; background:var(--card); color:inherit; text-decoration:none; }
  .card:hover { border-color: var(--accent); }
  .card strong { display:block; font-size:1.05rem; }
  .badge { display:inline-block; margin-top:8px; font-size:.75rem; padding:2px 8px; border-radius:999px; background:color-mix(in srgb, var(--accent) 15%, transparent); color:var(--accent); }
  .center { text-align:center; padding-top: 18vh; }
</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

function appHref(app: RegistryApp): string {
  return isDeployed(app.slug) ? `/apps/${app.slug}/` : app.url || `/apps/${app.slug}/`;
}

function appsListPage(): string {
  const apps = listApps("actif");
  const cards = apps
    .map(
      (app) => `<a class="card" href="${escapeHtml(appHref(app))}">
  <strong>${escapeHtml(app.name)}</strong>
  ${app.badge ? `<span class="badge">${escapeHtml(app.badge)}</span>` : ""}
  ${app.gratuit ? `<span class="badge">Gratuit</span>` : ""}
</a>`,
    )
    .join("\n");
  return page(
    "Nos applications",
    `<h1>Nos applications</h1>
<p>${apps.length} application${apps.length > 1 ? "s" : ""} de l'écosystème Alphabette. <a href="/">Retour à l'accueil</a></p>
<div class="grid">${cards}</div>`,
  );
}

function comingSoonPage(app?: RegistryApp): string {
  const name = app?.name || "Cette application";
  const hint =
    app?.status === "maintenance"
      ? "est en maintenance. Elle revient très vite."
      : "sera bientôt disponible.";
  return page(
    app?.name || "Bientôt disponible",
    `<div class="center">
<h1>Bientôt disponible</h1>
<p>${escapeHtml(name)} ${hint}</p>
<p><a href="https://alphabette.fr/apps">Voir les applications disponibles</a></p>
</div>`,
  );
}

// --- Fichiers des applications ---

function appDir(slug: string): string {
  return path.join(APPS_DIR, slug);
}

function isDeployed(slug: string): boolean {
  return fs.existsSync(path.join(appDir(slug), "index.html"));
}

const staticCache = new Map<string, express.Handler>();

function staticFor(slug: string): express.Handler {
  let handler = staticCache.get(slug);
  if (!handler) {
    handler = express.static(appDir(slug), { index: "index.html", fallthrough: true });
    staticCache.set(slug, handler);
  }
  return handler;
}

/**
 * Sert l'application `slug` pour le chemin `subPath` (« / », « /assets/x.js »…).
 * Les routes internes d'une appli monopage retombent sur son index.html.
 */
function serveApp(slug: string, subPath: string, req: Request, res: Response): void {
  const app = getApp(slug);
  // Appli active mais pas encore déposée dans le hub : on renvoie vers son adresse actuelle.
  if (app && app.status === "actif" && !isDeployed(app.slug) && app.url && /^https?:\/\//i.test(app.url)) {
    let target: URL | null = null;
    try {
      target = new URL(app.url);
    } catch {
      target = null;
    }
    if (target && target.hostname.replace(/^www\./, "") !== (req.hostname || "").replace(/^www\./, "")) {
      res.redirect(302, app.url);
      return;
    }
  }
  if (!app || app.status !== "actif" || !isDeployed(app.slug)) {
    res.status(200).type("html").setHeader("Cache-Control", "no-store");
    res.send(comingSoonPage(app));
    return;
  }

  const isPage = subPath === "/" || subPath === "/index.html" || !path.extname(subPath);
  if (isPage && req.method === "GET") countVisit(app.slug);

  const originalUrl = req.url;
  const query = originalUrl.includes("?") ? originalUrl.slice(originalUrl.indexOf("?")) : "";
  req.url = `${subPath}${query}`;
  staticFor(app.slug)(req, res, () => {
    req.url = originalUrl;
    if (path.extname(subPath) && subPath !== "/index.html") {
      res.status(404).type("text").send("Fichier introuvable.");
      return;
    }
    res.sendFile(path.join(appDir(app.slug), "index.html"));
  });
}

/**
 * Domaines dédiés : lidarsol.fr, lidarsol.eu, www.lidarsol.fr… servent
 * directement leur application à la racine. À monter avant toutes les routes.
 */
export function dedicatedDomainMiddleware(req: Request, res: Response, next: NextFunction): void {
  const app = findAppByHost(req.hostname || "");
  if (!app) return next();
  // Les API du hub restent joignables (config, tarifs, dons) depuis le domaine dédié.
  if (req.path.startsWith("/api/")) return next();
  serveApp(app.slug, req.path, req, res);
}

/** Routes /apps et /apps/<slug>/… */
export function createAppsHostingRouter(): Router {
  const router = Router();

  router.get(["/", ""], (req: Request, res: Response) => {
    if (req.originalUrl.replace(/\?.*$/, "") === "/apps/") return res.redirect(301, "/apps");
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(appsListPage());
  });

  router.get("/:slug", (req: Request, res: Response, next: NextFunction) => {
    if (req.path.endsWith("/")) return next();
    // Le slash final est nécessaire pour que les chemins relatifs (./assets) fonctionnent.
    const query = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
    res.redirect(301, `/apps/${encodeURIComponent(req.params.slug)}/${query}`);
  });

  router.use("/:slug", (req: Request, res: Response) => {
    serveApp(req.params.slug, req.path || "/", req, res);
  });

  return router;
}

export { APPS_DIR, isDeployed };
