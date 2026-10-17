import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Router, type Request, type Response } from "express";

/**
 * @file goatPhotos.ts
 * Proxy des photos de joueurs (Wikimedia Commons).
 *
 * Pourquoi : `commons.wikimedia.org/wiki/Special:FilePath/...` ne renvoie pas
 * d'en-têtes CORS ; une image chargée depuis cette URL « contamine » le canvas
 * (SecurityError) et rend impossible la génération de l'image de partage.
 *
 * La solution : servir la photo depuis notre propre domaine. Le navigateur la
 * voit alors comme same-origin, le canvas reste exploitable, et l'image de
 * partage contient bien les vraies photos (et non les avatars de secours).
 *
 * Les fichiers sont mis en cache disque (data/cache/goat-photos) : chaque photo
 * n'est téléchargée qu'une seule fois.
 */

const CACHE_DIR = path.join(process.cwd(), "data", "cache", "goat-photos");
const ALLOWED_PREFIX = "https://commons.wikimedia.org/wiki/Special:FilePath/";
const MAX_BYTES = 5 * 1024 * 1024;
const USER_AGENT =
  "AlphabetteGoatChevreTheKing/1.0 (https://alphabette.fr/goat; contact@alphabette.fr)";

function cacheKey(src: string): string {
  return crypto.createHash("sha256").update(src).digest("hex").slice(0, 32);
}

function guessExtension(src: string): string {
  try {
    const name = decodeURIComponent(new URL(src).pathname).toLowerCase();
    for (const extension of [".jpg", ".jpeg", ".png", ".webp", ".gif"]) {
      if (name.endsWith(extension)) return extension === ".jpeg" ? ".jpg" : extension;
    }
  } catch {
    /* ignoré */
  }
  return ".jpg";
}

function contentTypeFor(extension: string): string {
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/jpeg";
}

export function createGoatPhotosRouter(): Router {
  const router = Router();

  /**
   * GET /api/goat/photo?src=<url Wikimedia Commons>
   * Renvoie la vignette de la photo, mise en cache disque.
   */
  router.get("/photo", async (req: Request, res: Response) => {
    const src = typeof req.query.src === "string" ? req.query.src : "";
    if (!src.startsWith(ALLOWED_PREFIX)) {
      res.status(400).json({ error: "Source de photo non autorisée." });
      return;
    }

    const extension = guessExtension(src);
    const filePath = path.join(CACHE_DIR, `${cacheKey(src)}${extension}`);

    if (fs.existsSync(filePath)) {
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      res.setHeader("Content-Type", contentTypeFor(extension));
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    try {
      const upstream = await fetch(src, {
        headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
        redirect: "follow",
      });

      if (!upstream.ok) {
        res.status(502).json({ error: `Photo indisponible (amont ${upstream.status}).` });
        return;
      }

      const type = upstream.headers.get("content-type") || "";
      if (!type.startsWith("image/")) {
        res.status(502).json({ error: "La ressource distante n'est pas une image." });
        return;
      }

      const buffer = Buffer.from(await upstream.arrayBuffer());
      if (buffer.length === 0 || buffer.length > MAX_BYTES) {
        res.status(502).json({ error: "Photo vide ou trop volumineuse." });
        return;
      }

      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(filePath, buffer);

      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      res.setHeader("Content-Type", contentTypeFor(extension));
      res.send(buffer);
    } catch (err: any) {
      console.error("[GOAT_PHOTO_PROXY]", err?.message);
      res.status(502).json({ error: "Téléchargement de la photo impossible." });
    }
  });

  return router;
}
