/**
 * Importe une application dans le hub : apps/<slug>/.
 *
 *   bun run import:app <slug> <dossier-source>
 *
 * - Projet Vite (package.json présent) : installation puis construction avec
 *   des chemins relatifs (--base ./), pour que l'appli marche aussi bien à
 *   /apps/<slug>/ que sur son domaine dédié (lidarsol.fr…).
 * - Sinon (simple site HTML) : les fichiers sont copiés tels quels.
 *
 * L'entrée du registre (data/apps-registry.json) se règle ensuite dans /admin.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const [slug, source] = process.argv.slice(2);
if (!slug || !source || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error('Usage : bun run import:app <slug> <dossier-source>   (slug : minuscules, chiffres, tirets)');
  process.exit(1);
}

const src = path.resolve(source);
const dest = path.join(process.cwd(), "apps", slug);
if (!fs.existsSync(src)) {
  console.error(`Dossier introuvable : ${src}`);
  process.exit(1);
}

const SKIP = new Set([".git", ".github", "node_modules", "dist-alphabette", "bun.lock", "package-lock.json"]);
const SKIP_EXT = new Set([".md", ".ts", ".tsx"]);

function copyDir(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP.has(entry.name) || entry.name === "LICENSE") continue;
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(a, b);
    else if (!SKIP_EXT.has(path.extname(entry.name))) fs.copyFileSync(a, b);
  }
}

let built = src;
if (fs.existsSync(path.join(src, "package.json"))) {
  const outDir = path.join(src, "dist-alphabette");
  console.log(`→ Construction de ${slug}…`);
  execSync("bun install", { cwd: src, stdio: "inherit" });
  execSync(`bun x vite build --base ./ --outDir "${outDir}" --emptyOutDir`, { cwd: src, stdio: "inherit" });
  built = outDir;
}

if (!fs.existsSync(path.join(built, "index.html"))) {
  console.error(`Aucun index.html dans ${built} : rien à importer.`);
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
copyDir(built, dest);
// Un fichier CNAME de GitHub Pages n'a pas de sens dans le hub.
fs.rmSync(path.join(dest, "CNAME"), { force: true });
console.log(`✓ ${slug} importée dans apps/${slug}/ → /apps/${slug}/`);
