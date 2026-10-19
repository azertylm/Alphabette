/**
 * scripts/sync-shell.ts
 *
 * Met à jour la copie embarquée de la base commune (@alphabette/shell) dans un
 * ou plusieurs dépôts d'application déjà générés, ET migre les applications
 * anciennes qui dépendaient encore de `link:@alphabette/shell`. La source de
 * vérité est packages/shell du hub : une correction des barres se propage là,
 * sans re-générer les applications.
 *
 * Ce que fait la synchronisation, pour chaque application :
 *   1. copie packages/shell/src → <application>/src/shell (+ .shell-version) ;
 *   2. retire la dépendance fragile « @alphabette/shell: link:… » du
 *      package.json (l'alias Vite/tsconfig suffit désormais) ;
 *   3. installe les « paths » TypeScript vers src/shell (et retire l'option
 *      « baseUrl », supprimée par TypeScript 7), et @types/node si le
 *      vite.config importe node:* ;
 *   4. dépose le briefing écosystème le plus récent à la racine ;
 *   5. vérifie l'alias Vite — s'il manque, l'extrait exact à coller est affiché.
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
const BRIEFING_PATH = path.join(REPO_ROOT, 'docs', 'BRIEFING-ALPHABETTE.md');
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

const EXTRAIT_ALIAS = `  resolve: {
    alias: {
      '@alphabette/shell/style.css': path.resolve('src/shell/shell.css'),
      '@alphabette/shell': path.resolve('src/shell/index.ts'),
    },
  },`;

/** 2. Retire la dépendance « link: » du package.json (fiable : JSON). */
function retirerLienLanceur(cheminApp: string): string[] {
  const chemin = path.join(cheminApp, 'package.json');
  let json: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    json = JSON.parse(fs.readFileSync(chemin, 'utf8'));
  } catch {
    return [`⚠️  package.json illisible ou avec commentaires : dépendance « link: » à retirer à la main.`];
  }
  const notes: string[] = [];
  for (const bloc of [json.dependencies, json.devDependencies]) {
    if (bloc && bloc['@alphabette/shell']) {
      delete bloc['@alphabette/shell'];
      notes.push('dépendance « link:@alphabette/shell » retirée du package.json');
    }
  }
  if (notes.length) fs.writeFileSync(chemin, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  return notes;
}

/** 3. Installe les « paths » TypeScript (et retire baseUrl si présent). */
function installerPaths(cheminApp: string): string[] {
  const chemin = path.join(cheminApp, 'tsconfig.json');
  let json: {
    compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
  };
  try {
    json = JSON.parse(fs.readFileSync(chemin, 'utf8'));
  } catch {
    return [`⚠️  tsconfig.json illisible : ajouter "paths": {"@alphabette/shell": ["./src/shell/index.ts"], "@alphabette/shell/style.css": ["./src/shell/shell.css"]} à la main (sans « baseUrl », supprimée par TypeScript 7).`];
  }
  if (!json.compilerOptions) json.compilerOptions = {};
  const options = json.compilerOptions;
  const notes: string[] = [];

  if (options.baseUrl) {
    delete options.baseUrl;
    notes.push('« baseUrl » retirée (supprimée par TypeScript 7)');
  }
  const attendu: Record<string, string[]> = {
    '@alphabette/shell': ['./src/shell/index.ts'],
    '@alphabette/shell/style.css': ['./src/shell/shell.css'],
  };
  const actuel = options.paths ?? {};
  const aJour =
    JSON.stringify(actuel['@alphabette/shell']) === JSON.stringify(attendu['@alphabette/shell']) &&
    JSON.stringify(actuel['@alphabette/shell/style.css']) === JSON.stringify(attendu['@alphabette/shell/style.css']);
  if (!aJour) {
    options.paths = { ...attendu, ...actuel };
    notes.push('paths TypeScript « @alphabette/shell » installés');
  }
  fs.writeFileSync(chemin, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  return notes;
}

/** 3bis. @types/node si vite.config importe node:* (sinon tsc échoue). */
function installerTypesNode(cheminApp: string): string[] {
  const config = path.join(cheminApp, 'vite.config.ts');
  if (!fs.existsSync(config)) return [];
  const contenu = fs.readFileSync(config, 'utf8');
  if (!/from 'node:/.test(contenu)) return [];

  const chemin = path.join(cheminApp, 'package.json');
  let json: { devDependencies?: Record<string, string> };
  try {
    json = JSON.parse(fs.readFileSync(chemin, 'utf8'));
  } catch {
    return [`⚠️  package.json illisible : ajouter @types/node en devDependencies à la main.`];
  }
  json.devDependencies ??= {};
  if (json.devDependencies['@types/node']) return [];
  json.devDependencies['@types/node'] = '^22.14.0';
  fs.writeFileSync(chemin, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  return ['@types/node ajouté en devDependencies (vite.config importe node:*)'];
}

/** 4. Vérifie que vite.config.ts résout l'alias, sinon affiche l'extrait. */
function verifierAlias(cheminApp: string): string[] {
  const candidates = ['vite.config.ts', 'vite.config.js', 'vite.config.mts'];
  const note: string[] = [];
  for (const nom of candidates) {
    const chemin = path.join(cheminApp, nom);
    if (!fs.existsSync(chemin)) continue;
    const contenu = fs.readFileSync(chemin, 'utf8');
    // L'alias doit être DANS un objet alias, pas une simple mention
    // (optimizeDeps.exclude contient aussi le nom du paquet).
    const aAlias = /alias\s*:\s*\{[^}]*@alphabette\/shell/s.test(contenu);
    if (!aAlias) {
      note.push(
        `⚠️  ${nom} : alias « @alphabette/shell » absent. Ajouter :\n${EXTRAIT_ALIAS}\n      (et « import path from 'node:path'; » en haut).`,
      );
    }
    return note;
  }
  return [`⚠️  Aucun vite.config.* trouvé : la base ne serait pas résolue.`];
}

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

  // 1. La copie embarquée de la base.
  const marqueur = path.join(cible, '.shell-version');
  const avant = fs.existsSync(marqueur) ? fs.readFileSync(marqueur, 'utf8').trim() : 'copie locale « link: »';
  if (fs.existsSync(cible)) {
    fs.rmSync(cible, { recursive: true });
  }
  fs.cpSync(path.join(SHELL_DIR, 'src'), cible, { recursive: true });
  fs.writeFileSync(marqueur, `${version}\n`, 'utf8');
  console.log(`✄  ${app} : base commune ${avant} → ${version}.`);

  // 2 à 5. Migration du projet vers l'embarquement autonome.
  for (const note of [...retirerLienLanceur(app), ...installerPaths(app), ...installerTypesNode(app), ...verifierAlias(app)]) {
    console.log(note);
  }

  // 4. Briefing écosystème le plus récent (+ AGENTS.md s'il n'en a pas).
  if (fs.existsSync(BRIEFING_PATH)) {
    fs.copyFileSync(BRIEFING_PATH, path.join(app, 'BRIEFING-ALPHABETTE.md'));
    const agents = path.join(app, 'AGENTS.md');
    if (!fs.existsSync(agents)) {
      fs.writeFileSync(
        agents,
        [
          '# AGENTS.md — Application de l’écosystème ALPHABETTE',
          '',
          '**AVANT d’écrire la moindre ligne de code : lis `BRIEFING-ALPHABETTE.md`** à la',
          'racine de ce dépôt — il contient les règles des barres du haut (écosystème +',
          'application), les tarifs, les pièges connus et le rituel de livraison.',
          '',
          '- L’identité du site se règle UNIQUEMENT dans `src/alphabette.app.ts` ;',
          '- `src/shell/` est la base commune générée : ne pas recoder, ne pas dupliquer ;',
          '- avant de rendre le travail : `bun run lint` + `bun run build`, et joindre un',
          '  aperçu réel (rendu ou capture) — un rendu qu’on ne voit pas n’est pas terminé.',
          '',
        ].join('\n'),
        'utf8',
      );
      console.log('AGENTS.md créé (oriente toute IA vers le briefing).');
    }
  }
}

console.log('');
console.log('Pense à vérifier puis relancer : bun install && bun run lint && bun run dev.');
