/**
 * server/alphabetteAudio.ts
 * Voix Alphabette côté serveur — la clé GEMINI_API_KEY ne quitte jamais le serveur.
 *
 *   POST /api/alphabette/tts         { text }                  → { fallback, audioBase64, mimeType }
 *   POST /api/alphabette/transcribe  { audioBase64, mimeType } → { texte }
 *
 * Réutilisable dans toute application qui a un serveur Express :
 *   app.use("/api/alphabette", createAlphabetteAudioRouter());   // AVANT app.use(express.json())
 */
import express, { type Request, type Response, Router } from "express";
import { GoogleGenAI } from "@google/genai";
import {
  MODELE_TTS,
  MODELES_TTS_SECOURS,
  MODELE_TRANSCRIPTION,
  MODELES_TRANSCRIPTION_SECOURS,
  corpsRequeteTts,
  garantirWav,
  base64VersOctets,
} from "../packages/shell/src/audio/voixGemini";
import { corpsTranscription } from "../packages/shell/src/audio/dictee";

const DELAI_MS = 14000;
const TEXTE_MAX = 1200;

let client: GoogleGenAI | null = null;
function gemini(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  // v1beta obligatoire : la version v1 par défaut rejette speechConfig (erreur 400).
  if (!client) client = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
  return client;
}

function avecDelai<T>(p: Promise<T>, ms = DELAI_MS): Promise<T> {
  return Promise.race([p, new Promise<T>((_, ko) => setTimeout(() => ko(new Error("délai dépassé")), ms))]);
}

async function synthese(texte: string): Promise<{ audioBase64: string; mimeType: string } | null> {
  const ai = gemini();
  if (!ai) return null;
  const debut = Date.now();
  for (const model of [process.env.ALPHABETTE_TTS_MODEL || MODELE_TTS, ...MODELES_TTS_SECOURS]) {
    // 1er essai avec le style « voix chaleureuse », puis retry automatique sans speechMetadata.
    for (const avecStyle of [true, false]) {
      const reste = DELAI_MS - (Date.now() - debut);
      if (reste < 1500) return null;
      try {
        const corps = corpsRequeteTts(texte, avecStyle);
        const r = await avecDelai(
          ai.models.generateContent({ model, contents: corps.contents as any, config: corps.generationConfig as any }),
          reste,
        );
        const part = r.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data) as any;
        if (!part) continue;
        // Normalement déjà un WAV complet (RIFF 44 octets) : garantirWav le laisse intact.
        const wav = garantirWav(base64VersOctets(part.inlineData.data), part.inlineData.mimeType);
        return { audioBase64: Buffer.from(wav).toString("base64"), mimeType: "audio/wav" };
      } catch (e: any) {
        const statut = e?.status ?? e?.code;
        if (statut === 404 || /not found|is not supported/i.test(String(e?.message))) break;
        if (/délai/.test(String(e?.message))) return null;
        console.warn("[ALPHABETTE_TTS]", model, avecStyle ? "avec style" : "sans style", e?.message);
      }
    }
  }
  return null;
}

export function createAlphabetteAudioRouter(): Router {
  const router = Router();
  router.use(express.json({ limit: "15mb" }));

  const cache = new Map<string, { audioBase64: string; mimeType: string }>();

  router.post("/tts", async (req: Request, res: Response) => {
    const texte = String(req.body?.text ?? req.body?.texte ?? "").trim().slice(0, TEXTE_MAX);
    if (!texte) return void res.status(400).json({ fallback: true, audioBase64: null, error: "Texte vide." });
    const connu = cache.get(texte);
    if (connu) return void res.json({ fallback: false, ...connu });
    try {
      const r = await synthese(texte);
      if (!r) return void res.json({ fallback: true, audioBase64: null });
      cache.set(texte, r);
      if (cache.size > 200) cache.delete(cache.keys().next().value as string);
      res.json({ fallback: false, ...r });
    } catch {
      res.json({ fallback: true, audioBase64: null });
    }
  });

  router.post("/transcribe", async (req: Request, res: Response) => {
    const audioBase64 = String(req.body?.audioBase64 ?? "");
    const mimeType = String(req.body?.mimeType ?? "audio/webm");
    const ai = gemini();
    if (!audioBase64 || !ai) return void res.json({ texte: "", fallback: true });
    for (const model of [process.env.ALPHABETTE_TRANSCRIBE_MODEL || MODELE_TRANSCRIPTION, ...MODELES_TRANSCRIPTION_SECOURS]) {
      try {
        const r = await avecDelai(ai.models.generateContent({ model, contents: corpsTranscription(audioBase64, mimeType).contents as any }), 30000);
        const texte = (r.text ?? "").trim();
        if (texte) return void res.json({ texte });
      } catch (e: any) {
        console.warn("[ALPHABETTE_TRANSCRIBE]", model, e?.message);
      }
    }
    res.json({ texte: "", fallback: true });
  });

  return router;
}
