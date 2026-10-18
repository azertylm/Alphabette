import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { sovereignAIRouter } from "./server/ai/router";
import { AIProviderId, AIRequestOptions } from "./server/ai/types";
import { createAdminRouter, createPublicAppsRouter } from "./server/adminRoutes";

dotenv.config();

const PORT = 3000;

// Configuration commerciale centrale en mémoire (mise à jour instantanée sans redémarrage)
let commercialConfig = {
  hubUrl: "http://alphabette.fr",
  currency: "EUR",
  pricing: {
    singleApp: {
      byok: 39,      // 39 € / an
      managed: 59,   // 59 € / an (Clé Mistral incluse)
    },
    bouquet: {
      byok: 99,      // 99 € / an (Pass Bouquet BYOK)
      managed: 199,  // 199 € / an (Pass Bouquet Intégral avec Mistral inclus)
    },
  },
  activePromotion: {
    isActive: true,
    badgeLabel: "Offre Lancement Écosystème",
    discountPercent: 15,
    expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(), // 14 jours
    description: "-15% immédiats sur le Pass Bouquet Intégral avec le code SOUVERAIN15",
    couponCode: "SOUVERAIN15",
  },
  stripePaymentLinks: {
    single_byok: "https://buy.stripe.com/alphabette_single_byok_39",
    single_managed: "https://buy.stripe.com/alphabette_single_managed_59",
    bouquet_byok: "https://buy.stripe.com/alphabette_bouquet_byok_99",
    bouquet_integral: "https://buy.stripe.com/alphabette_bouquet_integral_199",
  },
  aiPolicy: {
    provider: "Mistral AI (Exclusif)",
    headquarters: "Paris, France",
    gdprCompliant: true,
    zeroPublicTraining: true,
    trialDaysIncluded: 7,
  },
  updatedAt: new Date().toISOString(),
};

// Registre des codes d'accès Amis / VIP à usage unique strict
interface VipCodeRecord {
  code: string;
  status: "active" | "consumed" | "revoked";
  durationMonths: number;
  planGranted: "bouquet_integral" | "bouquet_byok";
  recipientNote: string;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
  consumedByEmail?: string;
}

const vipCodesStore: Map<string, VipCodeRecord> = new Map([
  [
    "VIP-X89K2",
    {
      code: "VIP-X89K2",
      status: "active",
      durationMonths: 12,
      planGranted: "bouquet_integral",
      recipientNote: "Partenaire Ville de La Grande-Motte",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString(),
    },
  ],
  [
    "VIP-MISTRAL75",
    {
      code: "VIP-MISTRAL75",
      status: "active",
      durationMonths: 12,
      planGranted: "bouquet_integral",
      recipientNote: "Bêta-testeur Écosystème Mistral AI",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
    },
  ],
  [
    "VIP-PRESSE26",
    {
      code: "VIP-PRESSE26",
      status: "active",
      durationMonths: 6,
      planGranted: "bouquet_integral",
      recipientNote: "Accréditation Presse & Médias Tech",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
    },
  ],
]);

async function startServer() {
  const app = express();

  // Middleware JSON
  app.use(express.json());

  // --- API ROUTES FIRST ---

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      ecosystem: "ALPHABETTE Hub & Sovereign Mistral AI Engine",
      hubUrl: "http://alphabette.fr",
      time: new Date().toISOString(),
    });
  });

  // --- REGISTRE DES APPLICATIONS & CONSOLE D'ADMINISTRATION ---

  // Public : applications publiées (statut « actif ») pour la vitrine alphabette.fr
  app.use("/api/apps", createPublicAppsRouter());

  // Protégé : console /admin (mot de passe ADMIN_PASSWORD, session par cookie signé)
  app.use("/api/admin", createAdminRouter());

  // (Les API des applications — joueurs, photos, communauté — vivent désormais
  //  dans le dépôt de chaque application, sur son propre sous-domaine.)

  /**
   * 1. GET /api/config.json
   * Endpoint officiel consommé par les 15 applications pour synchroniser
   * en temps réel les tarifs de base, promotions actives et liens Stripe.
   */
  app.get("/api/config.json", (_req: Request, res: Response) => {
    // Entête CORS pour permettre la consommation fluide par toutes les sous-applications *.alphabette.fr
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json(commercialConfig);
  });

  /**
   * PUT /api/admin/config
   * Interface d'administration pour mettre à jour les tarifs ou la promo active
   */
  app.put("/api/admin/config", (req: Request, res: Response) => {
    try {
      const updates = req.body;
      commercialConfig = {
        ...commercialConfig,
        ...updates,
        pricing: {
          ...commercialConfig.pricing,
          ...(updates.pricing || {}),
        },
        activePromotion: {
          ...commercialConfig.activePromotion,
          ...(updates.activePromotion || {}),
        },
        updatedAt: new Date().toISOString(),
      };

      res.json({
        success: true,
        message: "Configuration commerciale mise à jour avec succès.",
        config: commercialConfig,
      });
    } catch (err: any) {
      res.status(500).json({ error: "Erreur lors de la mise à jour." });
    }
  });

  /**
   * 2. POST /api/verify-code
   * Endpoint de vérification et de consommation unique et sécurisée d'un code VIP / Ami.
   */
  app.post("/api/verify-code", (req: Request, res: Response) => {
    const { code, userEmail } = req.body as { code: string; userEmail?: string };

    if (!code || typeof code !== "string" || !code.trim()) {
      res.status(400).json({
        valid: false,
        error: "Veuillez fournir un code d'accès valide.",
      });
      return;
    }

    const sanitizedCode = code.trim().toUpperCase();
    const vipRecord = vipCodesStore.get(sanitizedCode);

    if (!vipRecord) {
      res.status(404).json({
        valid: false,
        error: "Code privilège inexistant ou erroné.",
      });
      return;
    }

    // Vérification stricte d'usage unique
    if (vipRecord.status === "consumed") {
      res.status(409).json({
        valid: false,
        status: "consumed",
        error: `Ce code a déjà été consommé le ${new Date(vipRecord.consumedAt || "").toLocaleDateString("fr-FR")}. Les codes ALPHABETTE sont à usage strictement unique pour empêcher toute fuite.`,
      });
      return;
    }

    if (vipRecord.status === "revoked") {
      res.status(403).json({
        valid: false,
        status: "revoked",
        error: "Ce code d'accès a été révoqué par l'administrateur.",
      });
      return;
    }

    // Vérification de la date d'expiration
    const now = new Date();
    if (new Date(vipRecord.expiresAt) < now) {
      res.status(410).json({
        valid: false,
        status: "expired",
        error: "La date limite d'activation de ce code est dépassée.",
      });
      return;
    }

    // Consommation immédiate du code (stricte consommation unique)
    vipRecord.status = "consumed";
    vipRecord.consumedAt = now.toISOString();
    vipRecord.consumedByEmail = userEmail || "utilisateur-vip@alphabette.fr";

    const grantedUntil = new Date();
    grantedUntil.setMonth(grantedUntil.getMonth() + vipRecord.durationMonths);

    res.json({
      valid: true,
      success: true,
      message: `Code VIP activé avec succès ! Vous bénéficiez de ${vipRecord.durationMonths} mois d'accès offert au Bouquet Complet ALPHABETTE.`,
      grantedPlan: vipRecord.planGranted,
      durationMonths: vipRecord.durationMonths,
      grantedUntil: grantedUntil.toISOString(),
      recipientNote: vipRecord.recipientNote,
      codeDetails: {
        code: vipRecord.code,
        status: vipRecord.status,
        consumedAt: vipRecord.consumedAt,
      },
    });
  });

  /**
   * POST /api/admin/generate-vip-code
   * Générateur de nouveaux codes d'accès uniques
   */
  app.post("/api/admin/generate-vip-code", (req: Request, res: Response) => {
    const { recipientNote = "Invité Privilège", durationMonths = 12, planGranted = "bouquet_integral" } = req.body;
    
    // Génère un code aléatoire sécurisé du type VIP-XXXXX
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const newCode = `VIP-${randomSuffix}`;

    const newRecord: VipCodeRecord = {
      code: newCode,
      status: "active",
      durationMonths: Number(durationMonths) || 12,
      planGranted: planGranted === "bouquet_byok" ? "bouquet_byok" : "bouquet_integral",
      recipientNote,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString(),
    };

    vipCodesStore.set(newCode, newRecord);

    res.json({
      success: true,
      codeRecord: newRecord,
      allActiveCodesCount: Array.from(vipCodesStore.values()).filter((c) => c.status === "active").length,
    });
  });

  /**
   * GET /api/admin/vip-codes
   * Liste des codes pour la vue de gestion
   */
  app.get("/api/admin/vip-codes", (_req: Request, res: Response) => {
    res.json({
      codes: Array.from(vipCodesStore.values()),
    });
  });

  // Get AI Provider Configuration Status (Secrets are never returned)
  app.get("/api/ai/config", (_req: Request, res: Response) => {
    const currentProvider = sovereignAIRouter.getDefaultProvider();
    res.json({
      activeProvider: currentProvider,
      availableProviders: [
        {
          id: "mistral_cloud",
          name: "Mistral AI Cloud Officiel France (Recommandé Production)",
          description: "Technologie exclusive Mistral AI hébergée en France/Europe. 100% conforme RGPD, zéro réutilisation des données d'utilisateurs pour l'entraînement.",
          status: process.env.MISTRAL_API_KEY ? "configured" : "ready",
          phase: "Production Officielle",
          headquarters: "Paris, France",
        },
        {
          id: "hybrid_mistral",
          name: "Moteur Hybride Souverain (Local Metal/Ollama + Secours Mistral Cloud)",
          description: "Priorité au serveur local haute performance (Mac Metal / Ollama, 0€ d'inférence). Bascule transparente vers l'API Cloud officielle de Mistral AI en cas de coupure.",
          status: "ready",
          phase: "Hybride Résilient",
          localUrl: process.env.LOCAL_AI_URL || "http://localhost:11434",
          timeoutMs: parseInt(process.env.LOCAL_AI_TIMEOUT_MS || "3500", 10),
          isMistralCloudConfigured: !!process.env.MISTRAL_API_KEY,
        },
        {
          id: "local",
          name: "Serveur Local Dédié Strict (Mac Metal / Ollama)",
          description: "100% Hors-ligne / In-House. Aucune transmission de données à l'extérieur.",
          status: "ready",
          phase: "Local Déconnecté",
        },
        {
          id: "gemini",
          name: "Phase 1 : Google Gemini (Prototypage & Sandbox)",
          description: "Actif pour la validation technique initiale dans Google AI Studio.",
          status: process.env.GEMINI_API_KEY ? "configured" : "missing_key",
          phase: "Prototypage",
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

  /**
   * Continuité : une application partie sur son propre sous-domaine conserve ses
   * anciennes adresses (alphabette.fr/goat → goatchevretheking.alphabette.fr).
   * Utile pour les liens déjà partagés et les anciens QR codes.
   */
  if (process.env.NODE_ENV === "production") {
    const APP_REDIRECTS: Record<string, string> = {
      "/goat": "https://goatchevretheking.alphabette.fr",
    };

    for (const [from, to] of Object.entries(APP_REDIRECTS)) {
      app.get([from, `${from}/*`], (req: Request, res: Response) => {
        res.redirect(301, `${to}${req.path.slice(from.length)}`);
      });
    }
  }

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
    console.log(`[ALPHABETTE] Hub Central démarré avec succès sur http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Échec critique du démarrage du serveur:", err);
  process.exit(1);
});
