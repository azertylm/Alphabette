#!/usr/bin/env node
/**
 * scripts/ensure-app-cover.mjs <slug> — garantit la couverture « Codex de Vinci » d'UNE application (idempotent).
 * Image personnelle déjà présente (public/covers/<slug>.jpg|png|webp… ou association souple) : intouchée (coverCustom).
 * Sinon : génère public/covers/<slug>.svg (1200×630, < 6 Ko, hors ligne) et renseigne `cover` dans data/apps-registry.json.
 * Appelé par scripts/create-app.ts à l'intégration d'une nouvelle application ; tout le registre : scripts/sync-covers.mjs.
 */
import { fileURLToPath } from 'node:url';
import { syncCovers } from './sync-covers.mjs';

const slug = process.argv[2];
if (!slug || slug.startsWith('-')) {
  console.error('Usage : node scripts/ensure-app-cover.mjs <slug>');
  process.exit(2);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { await syncCovers({ slug }); }
  catch (err) { console.error(`couverture : ${err.message}`); process.exit(1); }
}
