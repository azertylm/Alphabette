import fs from "fs";
import express, { Router, type Request, type Response } from "express";
import {
  COMMUNITY_IMAGES_DIR,
  CommunityError,
  CommunityPyramid,
  CommunityUser,
  createUser,
  deletePyramid,
  findPyramidImagePath,
  findUserByUsername,
  getPyramid,
  listPyramids,
  publishPyramid,
  toggleLike,
  verifyPasswordHash,
} from "./communityStore";
import {
  USER_COOKIE_NAME,
  attachedUser,
  checkAuthThrottle,
  clearAuthFailures,
  createUserToken,
  getCurrentUser,
  getVoterId,
  noteAuthFailure,
  peekVoterId,
  requireUser,
  userCookieOptions,
} from "./communityAuth";

/**
 * @file communityRoutes.ts
 * API publique + authentifiée de la communauté « Goat Chèvre The King » :
 * création de compte, connexion, publication d'une pyramide, galerie et votes.
 *
 * Monté sur /api/community (avant express.json() global, car les images
 * publiées peuvent peser plusieurs mégaoctets).
 */

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (value ? value.split(",")[0] : req.ip) || "unknown";
}

function publicUser(user: CommunityUser) {
  return { id: user.id, username: user.username, createdAt: user.createdAt };
}

/** Vue publique d'une pyramide (sans les données internes). */
function publicPyramid(pyramid: CommunityPyramid, viewerId: string | null) {
  return {
    id: pyramid.id,
    title: pyramid.title,
    authorName: pyramid.authorName,
    userId: pyramid.userId,
    sport: pyramid.sport,
    sportLabel: pyramid.sportLabel,
    controversy: pyramid.controversy,
    controversyLabel: pyramid.controversyLabel,
    hotTakeName: pyramid.hotTakeName,
    filled: pyramid.filled,
    total: pyramid.total,
    expertMode: pyramid.expertMode,
    format: pyramid.format,
    topPlayerId: pyramid.topPlayerId,
    topPlayerName: pyramid.topPlayerName,
    players: pyramid.players,
    likeCount: pyramid.voters.length,
    liked: viewerId ? pyramid.voters.includes(viewerId) : false,
    hidden: pyramid.hidden,
    createdAt: pyramid.createdAt,
    updatedAt: pyramid.updatedAt,
    // Le paramètre `v` force le navigateur à recharger l'image après republication.
    imageUrl: `/api/community/images/${pyramid.id}?v=${encodeURIComponent(pyramid.updatedAt)}`,
  };
}

function handleError(res: Response, err: unknown): void {
  if (err instanceof CommunityError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error("[COMMUNITY_API]", err);
  res.status(500).json({ error: "Erreur interne de la communauté." });
}

export function createCommunityRouter(): Router {
  const router = Router();

  // Les images publiées dépassent la limite JSON par défaut (100 ko).
  router.use(express.json({ limit: "12mb" }));

  /* ----------------------------- Session ----------------------------- */

  /** GET /api/community/me — état de connexion courant. */
  router.get("/me", (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    res.setHeader("Cache-Control", "no-store");
    res.json({ authenticated: Boolean(user), user: user ? publicUser(user) : null });
  });

  /** POST /api/community/register — création de compte (pseudo + mot de passe). */
  router.post("/register", (req: Request, res: Response) => {
    const ip = clientIp(req);
    const throttle = checkAuthThrottle(ip);
    if (throttle) {
      res.status(429).json({ error: throttle });
      return;
    }

    try {
      const user = createUser(req.body ?? {});
      clearAuthFailures(ip);
      res.cookie(USER_COOKIE_NAME, createUserToken(user.id), userCookieOptions(req));
      res.status(201).json({ success: true, user: publicUser(user) });
    } catch (err) {
      if (err instanceof CommunityError && err.status === 409) noteAuthFailure(ip);
      handleError(res, err);
    }
  });

  /** POST /api/community/login */
  router.post("/login", (req: Request, res: Response) => {
    const ip = clientIp(req);
    const throttle = checkAuthThrottle(ip);
    if (throttle) {
      res.status(429).json({ error: throttle });
      return;
    }

    const username = typeof req.body?.username === "string" ? req.body.username : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const user = findUserByUsername(username);

    if (!user || !verifyPasswordHash(password, user.passwordHash)) {
      noteAuthFailure(ip);
      res.status(401).json({ error: "Pseudo ou mot de passe incorrect." });
      return;
    }
    if (user.banned) {
      res.status(403).json({ error: "Ce compte est suspendu." });
      return;
    }

    clearAuthFailures(ip);
    res.cookie(USER_COOKIE_NAME, createUserToken(user.id), userCookieOptions(req));
    res.json({ success: true, user: publicUser(user) });
  });

  /** POST /api/community/logout */
  router.post("/logout", (req: Request, res: Response) => {
    res.clearCookie(USER_COOKIE_NAME, { ...userCookieOptions(req), maxAge: undefined });
    res.json({ success: true, authenticated: false });
  });

  /* ----------------------------- Galerie ----------------------------- */

  /** GET /api/community/pyramids?sport=&sort=&limit=&offset=&author=me */
  router.get("/pyramids", (req: Request, res: Response) => {
    try {
      const viewerId = peekVoterId(req);
      const currentUser = getCurrentUser(req);
      const mine = req.query.author === "me";
      if (mine && !currentUser) {
        res.status(401).json({ error: "Connecte-toi pour voir tes pyramides." });
        return;
      }

      const items = listPyramids({
        sport: typeof req.query.sport === "string" ? req.query.sport : null,
        sort: typeof req.query.sort === "string" ? req.query.sort : "recent",
        limit: Number(req.query.limit) || 24,
        offset: Number(req.query.offset) || 0,
        userId: mine && currentUser ? currentUser.id : null,
      });

      res.setHeader("Cache-Control", "no-store");
      res.json({ pyramids: items.map((pyramid) => publicPyramid(pyramid, viewerId)) });
    } catch (err) {
      handleError(res, err);
    }
  });

  /** GET /api/community/pyramids/:id */
  router.get("/pyramids/:id", (req: Request, res: Response) => {
    try {
      const pyramid = getPyramid(req.params.id);
      if (!pyramid || (pyramid.hidden && pyramid.userId !== getCurrentUser(req)?.id)) {
        res.status(404).json({ error: "Pyramide introuvable." });
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.json({ pyramid: publicPyramid(pyramid, peekVoterId(req)) });
    } catch (err) {
      handleError(res, err);
    }
  });

  /** POST /api/community/pyramids — publication d'une pyramide (compte requis). */
  router.post("/pyramids", requireUser, (req: Request, res: Response) => {
    try {
      const pyramid = publishPyramid({ ...(req.body ?? {}), user: attachedUser(req) });
      res.status(201).json({ success: true, pyramid: publicPyramid(pyramid, `user:${pyramid.userId}`) });
    } catch (err) {
      handleError(res, err);
    }
  });

  /** DELETE /api/community/pyramids/:id — suppression par son auteur. */
  router.delete("/pyramids/:id", requireUser, (req: Request, res: Response) => {
    try {
      deletePyramid(req.params.id, attachedUser(req).id);
      res.json({ success: true });
    } catch (err) {
      handleError(res, err);
    }
  });

  /** POST /api/community/pyramids/:id/like — j'aime (compte ou visiteur anonyme). */
  router.post("/pyramids/:id/like", (req: Request, res: Response) => {
    try {
      const voterId = getVoterId(req, res);
      const { pyramid, liked } = toggleLike(req.params.id, voterId);
      res.json({ success: true, liked, likeCount: pyramid.voters.length });
    } catch (err) {
      handleError(res, err);
    }
  });

  /* ------------------------------ Images ----------------------------- */

  /** GET /api/community/images/:id — image haute définition d'une pyramide. */
  router.get("/images/:id", (req: Request, res: Response) => {
    const filePath = findPyramidImagePath(req.params.id);
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ error: "Image introuvable." });
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Content-Type", filePath.endsWith(".jpg") ? "image/jpeg" : "image/png");
    fs.createReadStream(filePath).pipe(res);
  });

  return router;
}

/** Crée le dossier des images au démarrage (évite un 404 silencieux). */
export function ensureCommunityStorage(): void {
  try {
    fs.mkdirSync(COMMUNITY_IMAGES_DIR, { recursive: true });
  } catch (err: any) {
    console.error("[COMMUNITY] Création du dossier images impossible:", err?.message);
  }
}
