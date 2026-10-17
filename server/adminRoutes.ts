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
import {
  CommunityError,
  countPyramidsForUser,
  deletePyramid,
  listPyramids,
  listUsers,
  setPyramidHidden,
  setUserBanned,
} from "./communityStore";

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

function handleCommunityError(res: Response, err: unknown): void {
  if (err instanceof CommunityError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error("[COMMUNITY_ADMIN_API]", err);
  res.status(500).json({ error: "Erreur interne de la modération communauté." });
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
   */
  router.get("/", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
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

  // --- Modération de la communauté (pyramides partagées) ---

  /** Liste complète des pyramides publiées (masquées comprises). */
  router.get("/community/pyramids", requireAdmin, (req: Request, res: Response) => {
    try {
      const items = listPyramids({
        includeHidden: true,
        sort: typeof req.query.sort === "string" ? req.query.sort : "recent",
        sport: typeof req.query.sport === "string" ? req.query.sport : null,
        limit: Number(req.query.limit) || 60,
        offset: Number(req.query.offset) || 0,
      });
      res.setHeader("Cache-Control", "no-store");
      res.json({
        pyramids: items.map((pyramid) => ({
          id: pyramid.id,
          title: pyramid.title,
          authorName: pyramid.authorName,
          userId: pyramid.userId,
          sport: pyramid.sport,
          sportLabel: pyramid.sportLabel,
          controversy: pyramid.controversy,
          likeCount: pyramid.voters.length,
          filled: pyramid.filled,
          total: pyramid.total,
          hidden: pyramid.hidden,
          createdAt: pyramid.createdAt,
          imageUrl: `/api/community/images/${pyramid.id}?v=${encodeURIComponent(pyramid.updatedAt)}`,
        })),
      });
    } catch (err) {
      handleCommunityError(res, err);
    }
  });

  /** Masque / réaffiche une pyramide dans la galerie publique. */
  router.post("/community/pyramids/:id/hide", requireAdmin, (req: Request, res: Response) => {
    try {
      const hidden = req.body?.hidden !== false;
      const pyramid = setPyramidHidden(req.params.id, hidden);
      res.json({ success: true, id: pyramid.id, hidden: pyramid.hidden });
    } catch (err) {
      handleCommunityError(res, err);
    }
  });

  /** Suppression définitive d'une pyramide. */
  router.delete("/community/pyramids/:id", requireAdmin, (req: Request, res: Response) => {
    try {
      deletePyramid(req.params.id, null);
      res.json({ success: true });
    } catch (err) {
      handleCommunityError(res, err);
    }
  });

  /** Comptes de la communauté (avec le nombre de pyramides publiées). */
  router.get("/community/users", requireAdmin, (_req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json({
        users: listUsers().map((user) => ({
          id: user.id,
          username: user.username,
          createdAt: user.createdAt,
          banned: user.banned,
          pyramidCount: countPyramidsForUser(user.id),
        })),
      });
    } catch (err) {
      handleCommunityError(res, err);
    }
  });

  /** Suspend / réactive un compte. */
  router.post("/community/users/:id/ban", requireAdmin, (req: Request, res: Response) => {
    try {
      const banned = req.body?.banned !== false;
      const user = setUserBanned(req.params.id, banned);
      res.json({ success: true, id: user.id, banned: user.banned });
    } catch (err) {
      handleCommunityError(res, err);
    }
  });

  return router;
}
