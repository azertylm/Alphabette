/**
 * scripts/create-app.ts
 *
 * Générateur d'application de l'écosystème alphabette.fr.
 *
 * Crée, à partir de templates/app, un dépôt d'application autonome prêt à
 * démarrer : la base commune (@alphabette/shell) est déjà intégrée.
 *
 * Usage :
 *   bun run new:app infos-perso "Info Perso" "Votre curation intelligente"
 *   bun run new:app infos-perso "Info Perso" "Votre curation" --accent "#db2777"
 *   bun run new:app infos-perso "Info Perso" "Votre curation" --dir ../mon-dossier
 *
 * Options :
 *   --dir <chemin>    Dossier de destination (défaut : dossier frère « ../<slug> »)
 *   --accent <hex>    Couleur d'identité du site (défaut : #2563eb)
 *   --no-git          Ne pas initialiser de dépôt git ni faire de premier commit
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_DIR = path.join(REPO_ROOT, 'templates', 'app');
const SHELL_DIR = path.join(REPO_ROOT, 'packages', 'shell');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'apps-registry.json');

interface Args {
  slug: string;
  name: string;
  tagline: string;
  accent: string;
  dir: string;
  git: boolean;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  let accent = '#2563eb';
  let dir = '';
  let git = true;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--accent') {
      accent = argv[++i] ?? accent;
    } else if (arg === '--dir') {
      dir = argv[++i] ?? dir;
    } else if (arg === '--no-git') {
      git = false;
    } else {
      positional.push(arg);
    }
  }

  const [slug, name, tagline = 'Application de l’écosystème alphabette.fr'] = positional;

  if (!slug || !name) {
    console.error(
      'Usage : bun run new:app <slug> "Nom" "Sous-titre" [--accent "#hex"] [--dir <chemin>] [--no-git]',
    );
    process.exit(1);
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    console.error(
      `Slug invalide : « ${slug} ». Attendu : minuscules, chiffres et tirets (ex. « infos-perso »).`,
    );
    process.exit(1);
  }

  return {
    slug,
    name,
    tagline,
    accent,
    dir: dir || path.resolve(REPO_ROOT, '..', slug),
    git,
  };
}

/** Remplace les jetons du modèle dans tous les fichiers texte copiés. */
function fillTemplate(directory: string, tokens: Record<string, string>) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      fillTemplate(full, tokens);
      continue;
    }
    let content = fs.readFileSync(full, 'utf8');
    let changed = false;
    for (const [token, value] of Object.entries(tokens)) {
      if (content.includes(token)) {
        content = content.split(token).join(value);
        changed = true;
      }
    }
    if (changed) fs.writeFileSync(full, content, 'utf8');
  }
}

/**
 * Embarque la base commune dans l'application : copie de packages/shell/src
 * vers src/shell, plus un marqueur de version pour scripts/sync-shell.ts.
 * L'application est ainsi autonome — `bun install && bun run dev` fonctionne
 * immédiatement, sans `bun link`.
 */
function embarquerShell(destination: string) {
  const cible = path.join(destination, 'src', 'shell');
  fs.cpSync(path.join(SHELL_DIR, 'src'), cible, { recursive: true });

  const shellPackage = JSON.parse(fs.readFileSync(path.join(SHELL_DIR, 'package.json'), 'utf8'));
  const version = String(shellPackage.version ?? '0.0.0');
  fs.writeFileSync(path.join(cible, '.shell-version'), `${version}\n`, 'utf8');
  return version;
}

/** Inscription automatique au registre central (statut « brouillon »). */
function inscrireAuRegistre(args: Args, subdomain: string) {
  try {
    const registre = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    if (!Array.isArray(registre.apps)) return false;
    if (registre.apps.some((entree: { slug?: string }) => entree.slug === args.slug)) return false;

    const now = new Date().toISOString();
    registre.apps.push({
      id: args.slug,
      name: args.name.toUpperCase(),
      slug: args.slug,
      icon: 'Sparkles',
      status: 'brouillon',
      url: `https://${subdomain}.alphabette.fr`,
      subdomain,
      createdAt: now,
      updatedAt: now,
    });
    registre.updatedAt = now;
    fs.writeFileSync(REGISTRY_PATH, `${JSON.stringify(registre, null, 2)}\n`, 'utf8');
    return true;
  } catch (erreur) {
    console.warn(`⚠️  Inscription au registre impossible (« ${REGISTRY_PATH} ») : ${erreur instanceof Error ? erreur.message : erreur}`);
    return false;
  }
}

function run(command: string, args: string[], cwd: string) {
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(TEMPLATE_DIR)) {
    console.error(`Modèle introuvable : ${TEMPLATE_DIR}`);
    process.exit(1);
  }

  if (fs.existsSync(args.dir) && fs.readdirSync(args.dir).length > 0) {
    console.error(`Le dossier « ${args.dir} » existe déjà et n'est pas vide.`);
    process.exit(1);
  }

  const subdomain = args.slug.replace(/-/g, '');
  fs.mkdirSync(args.dir, { recursive: true });
  fs.cpSync(TEMPLATE_DIR, args.dir, { recursive: true });

  fillTemplate(args.dir, {
    __APP_SLUG__: args.slug,
    __APP_KEY__: args.slug,
    __APP_NAME__: args.name,
    __APP_TAGLINE__: args.tagline,
    __APP_ACCENT__: args.accent,
    __APP_SUBDOMAIN__: subdomain,
  });

  // La base commune est embarquée dans l'application : elle part avec les
  // barres du haut prêtes à l'emploi, pas besoin de `bun link`.
  const shellVersion = embarquerShell(args.dir);

  // Inscription immédiate au registre central (statut « brouillon ») : la
  // nouvelle application apparaît sur la vitrine GLM et dans la barre
  // écosystème des autres, dès qu'elle est activée dans la console /admin.
  const inscrit = inscrireAuRegistre(args, subdomain);

  if (args.git) {
    try {
      run('git', ['init', '-q'], args.dir);
      run('git', ['add', '.'], args.dir);
      run(
        'git',
        ['-c', 'user.name=ALPHABETTE', '-c', 'user.email=contact@alphabette.fr', 'commit', '-q', '-m', `chore: base commune @alphabette/shell pour ${args.name}`],
        args.dir,
      );
    } catch {
      console.warn('⚠️  git indisponible : dépôt non initialisé (relancer « git init » plus tard).');
    }
  }

  console.log('');
  console.log(`✅ Application « ${args.name} » créée dans : ${args.dir}`);
  console.log(`   Base commune embarquée : @alphabette/shell ${shellVersion} (src/shell/).`);
  if (inscrit) {
    console.log(`   Inscrite au registre central (statut « brouillon ») : ${subdomain}.alphabette.fr.`);
  }
  console.log('');
  console.log('Prochaines étapes :');
  console.log(`  1. cd "${args.dir}" && bun install`);
  console.log('  2. bun run dev — les barres du haut fonctionnent tout de suite.');
  console.log('  3. Renseigner l’identité dans src/alphabette.app.ts (couleur, liens).');
  console.log('  4. Activer l’application dans la console du hub (/admin) quand elle est en ligne.');
  console.log('     Pour toute évolution de la barre : bun run sync:shell ' + `"${args.dir}"` + ' depuis le hub.');
  console.log('');
}

main();
