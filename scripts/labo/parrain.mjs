/**
 * scripts/labo/parrain.mjs — Le Parrain : rapports de l'Atelier qualité publiés sur alphabette.eu.
 *   - /atelier/            : toutes les applications, leurs notes et le badge « Testé au Labo » (Le Jury) ;
 *   - /atelier/<id>/       : le rapport d'une appli, en français simple, avec pour chaque point la correction
 *                            et un prompt prêt à coller dans l'IA du créateur ;
 *   - /api/labo/atelier.json : notes et badges lus par les cartes du Laboratoire et le cadre des applis hébergées.
 * Données : dossier `atelier/` de la branche labo-donnees (workflow labo-atelier.yml), plus data/labo/plume.json
 * (relecture des textes par l'agent le-plume). Pages statiques, sans traceur, non indexées (noindex).
 */
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { AGENTS } from './atelier/analyse.mjs';

const e = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const lire = async (f, d) => { try { return JSON.parse(await readFile(f, 'utf8')); } catch { return d; } };
const dateFr = (d) => { try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }); } catch { return ''; } };
const GRAVITES = { bloquant: ['⛔', 'Bloquant', 'à corriger avant tout'], important: ['⚠️', 'Important', 'à corriger vite'], conseil: ['💡', 'Conseil', 'pour aller plus loin'] };

const STYLE = `:root{color-scheme:light dark;--f:#fff;--t:#1b1b1f;--d:#55555f;--b:#d9d9e1;--a:#4a2fe0;--c:#f5f5f8;--ok:#0d7a3e;--ko:#b3261e;--av:#8a5a00}
@media (prefers-color-scheme:dark){:root{--f:#121216;--t:#f1f1f4;--d:#b8b8c4;--b:#34343e;--a:#b3a6ff;--c:#1c1c23;--ok:#5fd393;--ko:#ff8a80;--av:#ffc26b}}
*{box-sizing:border-box}body{margin:0;background:var(--f);color:var(--t);font:17px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:16px}a{color:var(--a)}h1{font-size:1.6em;line-height:1.2;margin:.4em 0}h2{font-size:1.25em;margin:1.6em 0 .5em}
.haut{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.haut a{display:inline-flex;min-height:44px;align-items:center}
.doux{color:var(--d)}.badge{display:inline-block;padding:3px 12px;border-radius:999px;border:2px solid var(--ok);color:var(--ok);font-weight:700}
.badge.non{border-color:var(--b);color:var(--d);font-weight:500}
.notes{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr));gap:10px;margin:12px 0}
.note{background:var(--c);border:1px solid var(--b);border-radius:12px;padding:10px 12px}.note b{font-size:1.3em}
.barre{height:8px;border-radius:8px;background:var(--b);overflow:hidden;margin-top:6px}.barre i{display:block;height:100%;background:var(--a)}
.pb{border:1px solid var(--b);border-left:6px solid var(--b);border-radius:10px;padding:10px 12px;margin:10px 0;background:var(--c)}
.pb.bloquant{border-left-color:var(--ko)}.pb.important{border-left-color:var(--av)}.pb p{margin:.3em 0}
details summary{cursor:pointer;min-height:44px;display:flex;align-items:center}textarea{width:100%;min-height:110px;font:15px/1.4 ui-monospace,monospace;padding:8px;border-radius:8px;border:1px solid var(--b);background:var(--f);color:var(--t)}
button{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--a);background:var(--a);color:#fff;font:inherit;cursor:pointer}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 6px;border-bottom:1px solid var(--b);vertical-align:top}td.n{white-space:nowrap}
.capture{max-width:min(320px,100%);border:1px solid var(--b);border-radius:12px;display:block}
.agents{padding-left:1.2em}.agents li{margin:.3em 0}footer{margin:32px 0 12px;font-size:15px}`;

const page = (titre, description, corps) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(titre)}</title><meta name="description" content="${e(description)}"><meta name="robots" content="noindex">
<style>${STYLE}</style></head><body><main>${corps}
<footer class="doux">Atelier qualité du <a href="/">Laboratoire Alphabette</a> · contrôles automatiques, sans clic ni saisie, refaits chaque nuit ·
<a href="/charte-createurs">Charte des créateurs</a> · <a href="/mentions-legales">Mentions légales</a></footer>
</main><script>document.addEventListener('click',function(ev){var b=ev.target.closest('[data-copier]');if(!b)return;var t=document.getElementById(b.getAttribute('data-copier'));t.select();try{navigator.clipboard.writeText(t.value);}catch(x){document.execCommand('copy');}b.textContent='Copié ✓';});</script></body></html>
`;

const AGENTS_NOTES = ['douanier', 'pouce', 'opticien', 'poids_plume', 'phare', 'parapluie'];

function badgeHtml(j) {
  if (j?.teste_au_labo) return `<span class="badge">✓ Testé au Labo le ${e(dateFr(j.date))}</span>`;
  return `<span class="badge non">Pas encore « Testé au Labo »</span>${j?.raison ? ` <span class="doux">${e(j.raison)}</span>` : ''}`;
}

function rapportHtml(r, j, plume, capture) {
  const groupes = ['bloquant', 'important', 'conseil'].map((g) => [g, r.problemes.filter((p) => p.gravite === g)]).filter(([, l]) => l.length);
  let n = 0;
  const pbs = groupes.map(([g, liste]) => `<h2>${GRAVITES[g][0]} ${GRAVITES[g][1]} <span class="doux">(${liste.length}, ${GRAVITES[g][2]})</span></h2>` + liste.map((p) => {
    n++;
    return `<div class="pb ${g}"><p><strong>${e(p.titre)}</strong></p>${p.detail ? `<p class="doux">${e(p.detail)}</p>` : ''}
<p><em>${e(AGENTS[p.agent]?.nom ?? p.agent)}</em> — ${e(p.correction)}</p>
<details><summary>Prompt prêt à coller dans votre IA</summary><textarea id="p${n}" readonly>${e(p.prompt)}</textarea><p><button type="button" data-copier="p${n}">Copier</button></p></details></div>`;
  }).join('')).join('');
  const notes = AGENTS_NOTES.map((a) => `<div class="note"><span>${e(AGENTS[a].nom)}</span> <b>${r.scores[a]}</b>/100<div class="barre"><i style="width:${r.scores[a]}%"></i></div><span class="doux">${e(AGENTS[a].role)}</span></div>`).join('');
  const lienApp = r.url_publique || r.url;
  const plumeHtml = plume?.corrections?.length ? `<h2>✍️ Le Plume — relecture des textes</h2>${plume.verdict ? `<p>${e(plume.verdict)}</p>` : ''}<table><tr><th>Avant</th><th>Proposé</th><th>Pourquoi</th></tr>${plume.corrections.slice(0, 15).map((c) => `<tr><td>${e(c.avant)}</td><td>${e(c.apres)}</td><td class="doux">${e(c.pourquoi)}</td></tr>`).join('')}</table>` : '';
  return page(`${r.nom} — rapport de l'Atelier qualité | Alphabette`, `Contrôle qualité de ${r.nom} : sécurité, téléphone, lisibilité, vitesse, référencement et cadre légal.`, `
<p class="haut"><a href="/atelier/">← Toutes les applications</a></p>
<h1>${e(r.nom)}</h1>
<p>${badgeHtml(j)}</p>
<p>Note de l'atelier : <strong>${r.note}/100</strong> · contrôle technique : <strong>${r.controle_technique}/100</strong>
${r.communaute ? ' · application du collectif' : ''}${r.heberge ? ' · hébergée et isolée par Alphabette' : ''}</p>
<p class="doux">Contrôlée le ${e(dateFr(r.date))}${r.ref ? ` (version ${e(String(r.ref).slice(0, 7))})` : ''} · <a href="${e(lienApp)}">ouvrir l'application</a></p>
<div class="notes">${notes}</div>
${capture ? `<h2>📸 Le Témoin — écran d'accueil sur téléphone</h2><img class="capture" src="${e(capture)}" alt="Écran d'accueil de ${e(r.nom)} sur un téléphone de 390 px de large" loading="lazy" width="390">` : ''}
${r.problemes.length ? pbs : '<h2>🎉 Aucun point relevé</h2><p>Rien à corriger lors de ce contrôle.</p>'}
${plumeHtml}
<h2>Mesures</h2><p class="doux">${r.mesures.poids_ko} Ko au chargement · ${r.mesures.requetes} requêtes · ${r.mesures.chargement_ms ?? '?'} ms · EcoIndex ${r.mesures.ecoindex}/100 · ${r.mesures.contraste_ok_pct} % des textes bien contrastés${r.mesures.tiers.length ? ` · services tiers : ${e(r.mesures.tiers.join(', '))}` : ' · aucun service tiers'}</p>`);
}

function indexHtml(index, jury) {
  const apps = Object.values(index.apps ?? {}).sort((a, b) => b.note - a.note || a.nom.localeCompare(b.nom, 'fr'));
  const lignes = apps.map((a) => `<tr><td><a href="/atelier/${e(a.id)}/">${e(a.nom)}</a>${a.communaute ? ' <span class="doux">· collectif</span>' : ''}<br>${jury[a.id]?.teste_au_labo ? `<span class="badge">✓ Testé au Labo</span>` : ''}</td>
<td class="n"><strong>${a.note}</strong>/100</td><td class="n">${a.controle_technique}/100</td><td class="n">${a.compte.bloquant ? `⛔ ${a.compte.bloquant}` : ''} ${a.compte.important ? `⚠️ ${a.compte.important}` : ''} ${!a.compte.bloquant && !a.compte.important ? '✓' : ''}</td></tr>`).join('');
  const agents = Object.entries(AGENTS).map(([, v]) => `<li><strong>${e(v.nom)}</strong> — ${e(v.role)}</li>`).join('');
  return page("L'Atelier qualité du Laboratoire Alphabette", 'Chaque nuit, sept agents contrôlent les applications du Laboratoire Alphabette : sécurité, téléphone, lisibilité, vitesse, référencement et cadre légal.', `
<p class="haut"><a href="/">← Le Laboratoire</a></p>
<h1>L'Atelier qualité</h1>
<p>Chaque nuit, sept agents ouvrent chaque application comme un visiteur sur téléphone, sans rien cliquer ni saisir, et notent ce qu'ils voient.
Les créateurs reçoivent un rapport avec la correction et un prompt prêt à coller dans leur IA.</p>
<ul class="agents">${agents}<li><strong>Le Jury</strong> — badge « Testé au Labo » : aucun point bloquant, rien d'important côté sécurité ou légal, contrôle technique d'au moins 85/100, aucune erreur JavaScript, 3 jours de contrôle réussi sur les 7 derniers.</li></ul>
<p class="doux">Dernier passage : ${e(dateFr(index.date))}.</p>
<table><tr><th>Application</th><th>Note</th><th>Technique</th><th>Points</th></tr>${lignes || '<tr><td colspan="4">Premier passage de l\'atelier cette nuit.</td></tr>'}</table>`);
}

/** Publie l'atelier dans eu/ (pages + API). Sans données : une page d'attente et une API vide. */
export async function publierAtelier(eu, dossier) {
  const index = await lire(path.join(dossier, 'index.json'), { date: null, apps: {} });
  const jury = (await lire(path.join(dossier, 'jury.json'), { apps: {} })).apps ?? {};
  const plume = (await lire(path.join(process.cwd(), 'data', 'labo', 'plume.json'), { apps: {} })).apps ?? {};
  const sortie = path.join(eu, 'atelier');
  await mkdir(sortie, { recursive: true });
  let n = 0;
  for (const id of Object.keys(index.apps ?? {})) {
    if (!/^[a-z0-9-]+$/i.test(id)) continue;
    const r = await lire(path.join(dossier, 'rapports', `${id}.json`), null);
    if (!r) continue;
    r.url_publique = index.apps[id].url;
    let capture = null;
    const img = path.join(dossier, 'captures', `${id}.jpg`);
    if (existsSync(img)) {
      await mkdir(path.join(sortie, 'captures'), { recursive: true });
      await cp(img, path.join(sortie, 'captures', `${id}.jpg`));
      capture = `/atelier/captures/${id}.jpg`;
    }
    await mkdir(path.join(sortie, id), { recursive: true });
    await writeFile(path.join(sortie, id, 'index.html'), rapportHtml(r, jury[id], plume[id], capture));
    n++;
  }
  await writeFile(path.join(sortie, 'index.html'), indexHtml(index, jury));
  const api = {
    date: index.date,
    apps: Object.fromEntries(Object.entries(index.apps ?? {}).map(([id, a]) => [id, { note: a.note, controle_technique: a.controle_technique, compte: a.compte, apte: a.apte, date: a.date }])),
    jury,
  };
  await mkdir(path.join(eu, 'api', 'labo'), { recursive: true });
  await writeFile(path.join(eu, 'api', 'labo', 'atelier.json'), JSON.stringify(api, null, 2) + '\n');
  console.log(`atelier qualité : ${n} rapport(s) publiés dans eu/atelier/`);
  return n;
}

// Utilisé seul pour prévisualiser : node scripts/labo/parrain.mjs <dossier atelier> <dossier de sortie>
if (import.meta.url === `file://${process.argv[1]}`) {
  const [dossier = 'atelier', sortie = '/tmp/atelier-site'] = process.argv.slice(2);
  await publierAtelier(sortie, dossier);
  console.error(`Aperçu : ${sortie}/atelier/index.html (${(await readdir(path.join(sortie, 'atelier'))).length} éléments)`);
}
