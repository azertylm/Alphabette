import fs from "fs";
import path from "path";
import { Router, type Request, type Response } from "express";

/**
 * @file goatPlayers.ts
 * Sert la base de joueurs de Goat Chèvre The King (data/players.json),
 * générée par `bun run fetch:players`.
 */

interface CacheEntry {
  mtimeMs: number;
  payload: unknown;
}

let cache: CacheEntry | null = null;

const playersPath = () => path.join(process.cwd(), "data", "players.json");

function readPlayersFile(): unknown {
  const filePath = playersPath();
  const stat = fs.statSync(filePath);

  if (cache && cache.mtimeMs === stat.mtimeMs) {
    return cache.payload;
  }

  // Un éditeur Windows peut ajouter un BOM : on le retire avant de parser.
  const payload = JSON.parse(fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, ""));
  cache = { mtimeMs: stat.mtimeMs, payload };
  return payload;
}

interface GoatPlayerRecord {
  sport?: string;
  [key: string]: unknown;
}

export function createGoatPlayersRouter(): Router {
  const router = Router();

  /**
   * GET /api/goat/players?sport=football|nba
   * Renvoie la base des joueurs (filtrable par univers sportif).
   */
  router.get("/players", (req: Request, res: Response) => {
    try {
      const payload = readPlayersFile() as {
        players?: GoatPlayerRecord[];
        counts?: unknown;
      };

      res.setHeader("Cache-Control", "public, max-age=300");

      const sport = typeof req.query.sport === "string" ? req.query.sport : null;
      if (!sport) {
        res.json(payload);
        return;
      }

      if (sport !== "football" && sport !== "nba") {
        res.status(400).json({ error: "Univers inconnu : utilisez 'football' ou 'nba'." });
        return;
      }

      const players = (payload.players ?? []).filter((player) => player.sport === sport);
      res.json({ ...payload, players, filteredSport: sport, filteredCount: players.length });
    } catch (err: any) {
      if (err?.code === "ENOENT") {
        res.status(404).json({
          error:
            "Base de joueurs absente. Générez-la avec « bun run fetch:players » (script scripts/fetch-players.ts).",
        });
        return;
      }
      console.error("[GOAT_PLAYERS]", err);
      res.status(500).json({ error: "Lecture de la base des joueurs impossible." });
    }
  });

  return router;
}
