import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { sovereignAIRouter } from "./server/ai/router";
import { AIProviderId, AIRequestOptions } from "./server/ai/types";

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();

  // Middleware JSON
  app.use(express.json());

  // --- API ROUTES FIRST ---

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      ecosystem: "ALPHABETTE Hub & Sovereign AI Engine",
      founder: "Valentin RICHAUD",
      time: new Date().toISOString(),
    });
  });

  // Get AI Provider Configuration Status (Secrets are never returned)
  app.get("/api/ai/config", (_req: Request, res: Response) => {
    const currentProvider = sovereignAIRouter.getDefaultProvider();
    res.json({
      activeProvider: currentProvider,
      availableProviders: [
        {
          id: "gemini",
          name: "Phase 1 : Google Gemini (Prototypage & Validation)",
          description: "Actif par défaut pour le développement et la validation des fonctionnalités via @google/genai.",
          status: process.env.GEMINI_API_KEY ? "configured" : "missing_key",
          phase: "Phase 1",
        },
        {
          id: "hybrid_mistral",
          name: "Phase 2 & 3 : Moteur Hybride Souverain (Local + Secours Mistral Cloud)",
          description: "Priorité au serveur local haute performance (0€ d'inférence, données cloisonnées). Bascule automatique vers Mistral AI Cloud France en cas de panne.",
          status: "ready",
          phase: "Phases 2 & 3",
          localUrl: process.env.LOCAL_AI_URL || "http://localhost:11434",
          timeoutMs: parseInt(process.env.LOCAL_AI_TIMEOUT_MS || "3500", 10),
          isMistralCloudConfigured: !!process.env.MISTRAL_API_KEY,
        },
        {
          id: "local",
          name: "Serveur Local Dédié Strict (Ollama / vLLM)",
          description: "100% Hors-ligne / In-House. Aucune transmission de données à l'extérieur.",
          status: "ready",
          phase: "Phase 2",
        },
        {
          id: "mistral_cloud",
          name: "Mistral AI Cloud France (Direct)",
          description: "Modèle souverain européen hébergé en France, respect RGPD intégral.",
          status: process.env.MISTRAL_API_KEY ? "configured" : "missing_key",
          phase: "Phase 3",
        },
      ],
      localServerConfig: {
        endpoint: process.env.LOCAL_AI_URL || "http://localhost:11434",
        model: process.env.LOCAL_AI_MODEL || "mistral-nemo",
        timeoutMs: parseInt(process.env.LOCAL_AI_TIMEOUT_MS || "3500", 10),
      },
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasMistralKey: !!process.env.MISTRAL_API_KEY,
    });
  });

  // Switch default provider dynamically
  app.post("/api/ai/provider", (req: Request, res: Response) => {
    const { provider } = req.body as { provider: AIProviderId };
    if (!["gemini", "hybrid_mistral", "local", "mistral_cloud"].includes(provider)) {
      res.status(400).json({ error: "Fournisseur non valide." });
      return;
    }
    sovereignAIRouter.setDefaultProvider(provider);
    res.json({
      success: true,
      currentProvider: sovereignAIRouter.getDefaultProvider(),
    });
  });

  // Main Unified AI Entry Point: askAI(prompt, options)
  app.post("/api/ai/ask", async (req: Request, res: Response) => {
    try {
      const { prompt, options = {} } = req.body as {
        prompt: string;
        options?: AIRequestOptions;
      };

      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        res.status(400).json({ error: "Le paramètre 'prompt' est requis." });
        return;
      }

      const result = await sovereignAIRouter.askAI(prompt.trim(), options);
      res.json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error("[API_AI_ERROR]", err);
      res.status(500).json({
        success: false,
        error: err.message || "Erreur interne lors du traitement IA.",
      });
    }
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ALPHABETTE] Serveur démarré avec succès sur http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Échec critique du démarrage du serveur:", err);
  process.exit(1);
});
