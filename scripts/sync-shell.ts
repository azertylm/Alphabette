/**
 * scripts/sync-shell.ts
 *
 * Met à jour la copie embarquée de la base commune (@alphabette/shell) dans un
 * ou plusieurs dépôts d'application déjà générés. La source de vérité est
 * packages/shell du hub : une correction des barres se propage là, sans
 * re-générer les applications.
 *
 * Usage :
 *   bun run sync:shell ../revolution.alphabette.fr
 *   bun run sync:shell ../appli-a ../appli-b ../appli-c
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SHELL_DIR = path.join(REPO_ROOT, 'packages', 'shell');
const CIBLE_RELATIVE = path.join('src', 'shell');

const dossiers = process.argv.slice(2);
if (!dossiers.length) {
  console.error(
    'Usage : bun run sync:shell <chemin-application> [autres-chemins…]\n' +
      'La base (@alphabette/shell) du hub est recopiée dans <chemin-application>/src/shell.',
  );
  process.exit(1);
}

const shellPackage = JSON.parse(fs.readFileSync(path.join(SHELL_DIR, 'package.json'), 'utf8'));
const version = String(shellPackage.version ?? '0.0.0');

for (const cheminArg of dossiers) {
  const app = path.resolve(cheminArg);
  const cible = path.join(app, CIBLE_RELATIVE);

  if (!fs.existsSync(app)) {
    console.error(`❌ Dossier introuvable : ${app}`);
    continue;
  }
  if (!fs.existsSync(path.join(app, 'src'))) {
    console.error(`❌ Pas de « src/ » dans ${app} — ce n'est pas un dépôt d'application.`);
    continue;
  }

  const marqueur = path.join(cible, '.shell-version');
  const avant = fs.existsSync(marqueur) ? fs.readFileSync(marqueur, 'utf8').trim() : 'nouvelle copie';

  if (fs.existsSync(cible)) {
    fs.rmSync(cible, { recursive: true });
  }
  fs.cpSync(path.join(SHELL_DIR, 'src'), cible, { recursive: true });
  fs.writeFileSync(marqueur, `${version}\n`, 'utf8');

  console.log(`✅ ${app} : base commune ${avant} → ${version}.`);
}

console.log('');
console.log('Pense à vérifier puis relancer : bun install && bun run dev.');
