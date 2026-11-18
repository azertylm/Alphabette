#!/usr/bin/env node
/**
 * scripts/labo/gardien-transferts.mjs <ref_de_base> — liste (une par ligne) les applis qu'une Pull Request
 * fait entrer ou évoluer sur alphabette.fr : nouvelles « vitrine », version figée (vitrine.ref) changée,
 * ou page copiée dans vitrine/. Utilisé par .github/workflows/gardien-transfert.yml.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const base = process.argv[2] || 'origin/main';
const avant = (f) => { try { return JSON.parse(execFileSync('git', ['show', `${base}:${f}`], { encoding: 'utf8' })); } catch { return {}; } };
const maintenant = (f) => JSON.parse(readFileSync(f, 'utf8'));
const regA = avant('data/apps-registry.json').apps ?? [], regM = maintenant('data/apps-registry.json').apps ?? [];
const srcA = avant('data/apps-sources.json').apps ?? {}, srcM = maintenant('data/apps-sources.json').apps ?? {};
const pages = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`, '--', 'vitrine/'], { encoding: 'utf8' })
  .split('\n').filter(Boolean).map((f) => f.split('/')[1]);

const hote = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const cleDe = (app) => Object.entries(srcM).find(([c, s]) => hote(app.url) === `${c}.alphabette.fr` || (s.domains ?? []).includes(hote(app.url)))?.[0];

const ids = new Set();
for (const app of regM) {
  if (!app.vitrine) continue;
  const etait = regA.find((a) => a.id === app.id)?.vitrine;
  const cle = cleDe(app);
  const refChange = cle && JSON.stringify(srcA[cle]?.vitrine ?? null) !== JSON.stringify(srcM[cle]?.vitrine ?? null);
  let page = '';
  try { page = new URL(app.url).pathname.split('/')[1]; } catch { /* rien */ }
  if (!etait || refChange || (page && pages.includes(page))) ids.add(app.id);
}
console.log([...ids].join('\n'));
