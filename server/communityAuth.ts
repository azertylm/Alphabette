import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { CommunityUser, findUserById } from "./communityStore";

/**
 * @file communityAuth.ts
 * Sessions des comptes de la communauté « Goat Chèvre The King ».
 *
 * - Cookie httpOnly signé (HMAC-SHA256) contenant l'identifiant du compte.
 * - Un second cookie (visiteur) permet de « liker » une pyramide sans compte.
 * - Anti-force brute en mémoire sur la connexion et l'inscription.
 *
 * Aucune adresse e-mail n'est demandée : pseudo + mot de passe suffisent.
 */

export const USER_COOKIE_NAME = "alphabette_user";
export const VISITOR_COOKIE_NAME = "alphabette_visitor";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours
const VISITOR_TTL_MS = 400 * 24 * 60 * 60 * 1000; // ~13 mois
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

let fallbackSecret: string | null = null;

function getSigningSecret(): string {
  const configured = process.env.COMMUNITY_SESSION_SECRET;
  if (configured && configured.trim()) return configured;

  const adminSecret = process.env.ADMIN_SESSION_SECRET;
  if (adminSecret && adminSecret.trim()) return `${adminSecret}:community`;

  if (!fallbackSecret) {
    fallbackSecret = crypto.randomBytes(32).toString("hex");
    console.warn(
      "[COMMUNITY] COMMUNITY_SESSION_SECRET non défini : un secret temporaire a été généré. " +
        "Les sessions communauté seront invalidées au redémarrage du serveur.",
    );
  }
  return fallbackSecret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSigningSecret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(crypto.createHash("sha256").update(a).digest());
  const bufB = Buffer.from(crypto.createHash("sha256").update(b).digest());
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Jeton de session signé pour un compte donné. */
export function createUserToken(userId: string): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `v1.${userId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

/** Vérifie la signature et l'expiration puis renvoie l'identifiant du compte. */
export function verifyUserToken(token: unknown): string | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [version, userId, expiresAt, signature] = parts;
  if (version !== "v1" || !userId || !expiresAt) return null;
  if (!safeEqual(signature, sign(`${version}.${userId}.${expiresAt}`))) return null;
  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return null;
  return userId;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const chunk of header.split(";")) {
    const index = chunk.indexOf("=");
    if (index === -1) continue;
    const key = chunk.slice(0, index).trim();
    const value = chunk.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function isHttpsRequest(req: Request): boolean {
  const forwarded = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return req.secure || proto === "https";
}

export function userCookieOptions(req: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isHttpsRequest(req),
    path: "/",
    maxAge: SESSION_TTL_MS,
  };
}

export function visitorCookieOptions(req: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isHttpsRequest(req),
    path: "/",
    maxAge: VISITOR_TTL_MS,
  };
}

/** Identifiant du compte connecté, ou null. */
export function getSessionUserId(req: Request): string | null {
  return verifyUserToken(parseCookies(req.headers.cookie)[USER_COOKIE_NAME]);
}

/** Compte connecté (vérifie qu'il existe toujours), ou null. */
export function getCurrentUser(req: Request): CommunityUser | null {
  const userId = getSessionUserId(req);
  if (!userId) return null;
  const user = findUserById(userId);
  if (!user || user.banned) return null;
  return user;
}

/** Middleware : exige un compte connecté. */
export function requireUser(req: Request, res: Response, next: NextFunction): void {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Connecte-toi pour continuer.", authenticated: false });
    return;
  }
  (req as Request & { communityUser?: CommunityUser }).communityUser = user;
  next();
}

/** Compte connecté attaché par `requireUser`. */
export function attachedUser(req: Request): CommunityUser {
  return (req as Request & { communityUser?: CommunityUser }).communityUser as CommunityUser;
}

/**
 * Identifiant du votant : le compte connecté s'il existe, sinon un identifiant
 * anonyme stable conservé dans un cookie.
 */
export function getVoterId(req: Request, res: Response): string {
  const userId = getSessionUserId(req);
  if (userId) return `user:${userId}`;

  const cookies = parseCookies(req.headers.cookie);
  const existing = cookies[VISITOR_COOKIE_NAME];
  if (existing && /^[a-f0-9-]{36}$/.test(existing)) return `visitor:${existing}`;

  const visitorId = crypto.randomUUID();
  res.cookie(VISITOR_COOKIE_NAME, visitorId, visitorCookieOptions(req));
  return `visitor:${visitorId}`;
}

/** Même identifiant que `getVoterId`, mais sans jamais poser de cookie. */
export function peekVoterId(req: Request): string | null {
  const userId = getSessionUserId(req);
  if (userId) return `user:${userId}`;
  const existing = parseCookies(req.headers.cookie)[VISITOR_COOKIE_NAME];
  if (existing && /^[a-f0-9-]{36}$/.test(existing)) return `visitor:${existing}`;
  return null;
}

/* ------------------------------------------------------------------ */
/* Anti-force brute                                                    */
/* ------------------------------------------------------------------ */

interface AttemptRecord {
  count: number;
  firstAt: number;
}

const authAttempts = new Map<string, AttemptRecord>();

/** Renvoie un message d'erreur si l'IP a trop échoué, sinon null. */
export function checkAuthThrottle(ip: string): string | null {
  const record = authAttempts.get(ip);
  if (!record) return null;
  const now = Date.now();
  if (now - record.firstAt > ATTEMPT_WINDOW_MS) {
    authAttempts.delete(ip);
    return null;
  }
  if (record.count >= MAX_ATTEMPTS) {
    const minutes = Math.ceil((ATTEMPT_WINDOW_MS - (now - record.firstAt)) / 60000);
    return `Trop de tentatives échouées. Réessaie dans ${minutes} minute(s).`;
  }
  return null;
}

export function noteAuthFailure(ip: string): void {
  const now = Date.now();
  const current = authAttempts.get(ip);
  if (!current || now - current.firstAt > ATTEMPT_WINDOW_MS) {
    authAttempts.set(ip, { count: 1, firstAt: now });
    return;
  }
  authAttempts.set(ip, { count: current.count + 1, firstAt: current.firstAt });
}

export function clearAuthFailures(ip: string): void {
  authAttempts.delete(ip);
}
