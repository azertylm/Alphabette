/**
 * scripts/labo/vite-plugin-sobriete.mjs — plugin Vite « Cure d'amaigrissement » (Agent Gardien).
 *
 *   import sobriete from '<hub>/scripts/labo/vite-plugin-sobriete.mjs';
 *   export default defineConfig({ plugins: [react(), sobriete()] });
 *
 * À la construction : compresse sans perte les SVG produits (assets et public/), signale les
 * modules importés mais presque entièrement inutilisés (code mort que le tree-shaking de Vite
 * n'a pas pu retirer), et écrit dist/eco-bundle.json (poids par famille, plus gros morceaux).
 * Le plugin ne supprime jamais de code source : il le signale, l'agent décide.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { compresserSvg, compresserSvgDossier, poidsBuild } from './sobriete.mjs';

export default function sobriete({ seuilKo = 50 } = {}) {
  let sortie = 'dist';
  const morts = [];
  return {
    name: 'alphabette-sobriete',
    apply: 'build',
    configResolved(c) { sortie = path.resolve(c.root, c.build.outDir); },
    generateBundle(_o, bundle) {
      for (const f of Object.values(bundle)) {
        if (f.type === 'asset' && f.fileName.endsWith('.svg') && typeof f.source === 'string') f.source = compresserSvg(f.source);
        if (f.type !== 'chunk') continue;
        for (const [id, m] of Object.entries(f.modules)) {
          // Module volumineux dont presque rien ne reste après tree-shaking : import à revoir.
          if (m.originalLength > seuilKo * 1024 && m.renderedLength / m.originalLength < 0.1 && !id.includes('\0')) {
            morts.push({ module: path.relative(process.cwd(), id), original_ko: Math.round(m.originalLength / 1024), garde_ko: Math.round(m.renderedLength / 1024) });
          }
        }
      }
    },
    async writeBundle(_o, bundle) {
      const svg = await compresserSvgDossier(sortie);
      const morceaux = Object.values(bundle).filter((f) => f.type === 'chunk')
        .map((f) => ({ fichier: f.fileName, ko: Math.round(Buffer.byteLength(f.code) / 102.4) / 10 }))
        .sort((a, b) => b.ko - a.ko).slice(0, 8);
      const rapport = { genere_le: new Date().toISOString(), poids_ko: await poidsBuild(sortie), plus_gros_morceaux: morceaux, imports_a_revoir: morts, svg };
      await writeFile(path.join(sortie, 'eco-bundle.json'), JSON.stringify(rapport, null, 2));
      if (morts.length) this.warn(`Sobriété : ${morts.length} import(s) presque inutilisé(s), voir eco-bundle.json`);
    },
  };
}
