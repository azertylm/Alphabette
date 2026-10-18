import { Router, type Request, type Response } from "express";
import {
  APP_BADGES,
  APP_STATUSES,
  RegistryError,
  createApp,
  listApps,
  readRegistry,
  toggleAppVisibility,
  updateApp,
} from "./appsRegistry";
import {
  ADMIN_COOKIE_NAME,
  attemptLogin,
  createSessionToken,
  isAdminConfigured,
  isAuthenticated,
  requireAdmin,
  sessionCookieOptions,
} from "./adminAuth";

/**
 * @file adminRoutes.ts
 * Routes de la console d'administration ALPHABETTE.
 *
 * Monté sur /api/admin (protégé) et expose GET /api/apps (public).
 */

function handleRegistryError(res: Response, err: unknown): void {
  if (err instanceof RegistryError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error("[REGISTRY_API]", err);
  res.status(500).json({ error: "Erreur interne du registre des applications." });
}

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (value ? value.split(",")[0] : req.ip) || "unknown";
}

/** Routes publiques (vitrine alphabette.fr). */
export function createPublicAppsRouter(): Router {
  const router = Router();

  /**
   * GET /api/apps
   * Applications publiées (statut « actif ») consommées par la section « Nos Applications ».
   *
   * Lecture publique : la base commune des applications (@alphabette/shell) la
   * lit depuis chaque sous-domaine pour alimenter le panneau « Les applications
   * de l'écosystème ». D'où l'en-tête CORS, volontairement ouvert en lecture.
   */
  router.get("/", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({ apps: listApps("actif") });
  });

  return router;
}

/** Routes d'administration (protégées par mot de passe). */
export function createAdminRouter(): Router {
  const router = Router();

  // --- Authentification ---

  router.get("/session", (req: Request, res: Response) => {
    res.json({
      authenticated: isAuthenticated(req),
      configured: isAdminConfigured(),
    });
  });

  router.post("/login", (req: Request, res: Response) => {
    const result = attemptLogin(clientIp(req), req.body?.password);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error, authenticated: false });
      return;
    }
    res.cookie(ADMIN_COOKIE_NAME, createSessionToken(), sessionCookieOptions(req));
    res.json({ authenticated: true, success: true });
  });

  router.post("/logout", (req: Request, res: Response) => {
    res.clearCookie(ADMIN_COOKIE_NAME, { ...sessionCookieOptions(req), maxAge: undefined });
    res.json({ authenticated: false, success: true });
  });

  // --- Gestion du registre (tout ce qui suit exige une session valide) ---

  router.get("/apps", requireAdmin, (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ apps: listApps(), registry: readRegistry() });
  });

  router.get("/options", requireAdmin, (_req: Request, res: Response) => {
    res.json({ statuses: APP_STATUSES, badges: APP_BADGES });
  });

  router.post("/apps", requireAdmin, (req: Request, res: Response) => {
    try {
      const app = createApp(req.body ?? {});
      res.status(201).json({ success: true, app, apps: listApps() });
    } catch (err) {
      handleRegistryError(res, err);
    }
  });

  router.patch("/apps/:id", requireAdmin, (req: Request, res: Response) => {
    try {
      const app = updateApp(req.params.id, req.body ?? {});
      res.json({ success: true, app, apps: listApps() });
    } catch (err) {
      handleRegistryError(res, err);
    }
  });

  /** Bascule 1 clic : activer / masquer une application. */
  router.post("/apps/:id/toggle", requireAdmin, (req: Request, res: Response) => {
    try {
      const app = toggleAppVisibility(req.params.id);
      res.json({ success: true, app, apps: listApps() });
    } catch (err) {
      handleRegistryError(res, err);
    }
  });

  return router;
}
