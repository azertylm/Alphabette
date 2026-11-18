#!/usr/bin/env bun
/**
 * scripts/labo/conseil/conseil.ts — « Le Conseil des Agents » : évalue une mise à jour majeure issue des avis
 * d'alphabette.eu avant sa publication sur alphabette.fr. Trois agents antagonistes (Produit, Sécurité & Zéro
 * Connaissance, Simplicité) analysent le diff Git et les avis, débattent sur 2 tours au plus, puis un rapport de
 * décision JSON est écrit : verdict GO / NO_GO, note de consensus /100, synthèse exécutive de 5 lignes.
 *
 * Deux moteurs :
 *   bun scripts/labo/conseil/conseil.ts evaluer <app_id> --moteur api [--feedbacks /tmp/feedbacks.json]
 *       → appels directs via le routeur BYOK (bascule automatique). Clés lues dans l'environnement :
 *         CONSEIL_CHAINE="mistral,gemini" (ordre de secours) + MISTRAL_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY,
 *         OPENAI_API_KEY, DEEPSEEK_API_KEY, XAI_API_KEY ; modèle facultatif : CONSEIL_MODELE_<FOURNISSEUR>.
 *   bun scripts/labo/conseil/conseil.ts preparer <app_id> [--feedbacks …]   puis   … poursuivre <app_id>
 *       → moteur « relais » sans clé : les prompts sont écrits dans /tmp/conseil/<app_id>/tour<N>/<agent>.prompt.md ;
 *         la session Claude du Laboratoire fait répondre l'agent `conseiller` dans <agent>.json, puis « poursuivre ».
 *
 * Décision (déterministe, à partir des avis des agents — aucune note inventée) :
 *   - veto : l'Agent Sécurité en NO_GO avec au moins un risque bloquant → NO_GO ;
 *   - sinon NO_GO si au moins 2 agents en NO_GO, ou si la note moyenne est < 60 ; GO sinon (conditions reprises) ;
 *   - consensus = part d'agents alignés sur le verdict × 100 − écart-type des notes, borné à [0, 100].
 *   Le 2e tour n'a lieu que si le 1er n'a pas fait l'unanimité (même position, notes à moins de 20 points).
 * Sorties : data/labo/conseil/<app_id>.json (rapport complet) et data/labo/conseil.json (tableau de bord).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { appelerIA, type Fournisseur, type MaillonIA } from '../../../packages/shell/src/ia/routeurByok';
import { AGENTS, consigneTour2, type IdAgent } from './prompts';

type Position = 'GO' | 'GO_SOUS_CONDITIONS' | 'NO_GO';
interface AvisAgent { position: Position; note: number; resume: string; arguments: string[]; risques_bloquants: string[]; conditions: string[] }

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const IDS: IdAgent[] = ['produit', 'securite', 'simplicite'];
const args = process.argv.slice(2);
const opt = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const lire = <T,>(p: string, d: T): T => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return d; } };
const ecrire = (p: string, d: unknown) => { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(d, null, 2) + '\n'); };

/* ------------------------- Contexte : diff + avis ------------------------- */

function contexte(appId: string) {
  const registre = lire<{ apps: any[] }>(path.join(RACINE, 'data/apps-registry.json'), { apps: [] });
  const sources = lire<{ apps: Record<string, any> }>(path.join(RACINE, 'data/apps-sources.json'), { apps: {} });
  const fiche = registre.apps.find((a) => a.id === appId);
  if (!fiche) throw new Error(`Appli inconnue : ${appId}`);
  const hote = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const cle = Object.entries(sources.apps).find(([c, s]) => hote(fiche.url) === `${c}.alphabette.fr` || (s.domains ?? []).includes(hote(fiche.url)))?.[0];
  const src = cle ? sources.apps[cle] : null;
  let diff = '', base: string | null = null, tete: string | null = null, stats = '';
  if (src?.repo) {
    tete = execFileSync('git', ['ls-remote', `https://github.com/${src.repo}.git`, `refs/heads/${src.branch || 'main'}`], { encoding: 'utf8' }).split('\t')[0];
    base = src.vitrine?.ref ?? null;
    if (base && base !== tete) {
      const c = JSON.parse(execFileSync('gh', ['api', `repos/${src.repo}/compare/${base}...${tete}`], { encoding: 'utf8', maxBuffer: 80 * 1024 * 1024 }));
      const fichiers = (c.files ?? []).filter((f: any) => !/(^|\/)(dist|node_modules)\/|lock(file)?\b|\.lock$|package-lock\.json|\.(png|jpe?g|webp|ico|woff2?)$/.test(f.filename));
      stats = `${c.total_commits} commits, ${fichiers.length} fichiers (${fichiers.reduce((s: number, f: any) => s + f.additions, 0)} ajouts, ${fichiers.reduce((s: number, f: any) => s + f.deletions, 0)} suppressions)`;
      // Le code source d'abord, puis le reste ; 60 000 caractères au plus.
      fichiers.sort((a: any, b: any) => Number(/^src\//.test(b.filename)) - Number(/^src\//.test(a.filename)));
      for (const f of fichiers) {
        const bloc = `\n### ${f.filename} (${f.status}, +${f.additions} −${f.deletions})\n${(f.patch ?? '(diff non fourni par GitHub : fichier trop gros ou binaire)').slice(0, 12000)}\n`;
        if (diff.length + bloc.length > 60000) { diff += `\n(… ${fichiers.length} fichiers au total, diff tronqué à 60 000 caractères)\n`; break; }
        diff += bloc;
      }
      diff += `\nCommits :\n${(c.commits ?? []).slice(-30).map((x: any) => `- ${x.sha.slice(0, 7)} ${x.commit.message.split('\n')[0]}`).join('\n')}\n`;
    } else if (!base) {
      stats = "Première publication sur alphabette.fr : pas de version précédente, l'ensemble de l'appli est évalué (liste des fichiers ci-dessous).";
      const arbre = JSON.parse(execFileSync('gh', ['api', `repos/${src.repo}/git/trees/${tete}?recursive=1`], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }));
      diff = (arbre.tree ?? []).filter((t: any) => t.type === 'blob' && /^(src|public|index\.html|package\.json|vite\.config)/.test(t.path)).slice(0, 200).map((t: any) => `${t.path} (${t.size} o)`).join('\n');
    } else {
      stats = 'Aucune différence entre la version publiée et la version candidate.';
    }
  }
  const fb = lire<{ feedbacks?: any[] }>(opt('feedbacks') ?? '/tmp/feedbacks.json', { feedbacks: [] }).feedbacks ?? [];
  const decisions = lire<{ decisions: Record<string, any> }>(path.join(RACINE, 'data/labo/decisions.json'), { decisions: {} }).decisions;
  const avis = fb.filter((a) => a.app_id === appId && a.source !== 'agent_chaos')
    .map((a) => ({ ...a, status: decisions[a.id]?.status ?? a.status }))
    .filter((a) => a.status !== 'rejected')
    .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0)).slice(0, 40);
  const notes = avis.map((a) => a.rating).filter(Number.isInteger);
  const lignesAvis = avis.map((a) => `- [${a.category}${a.rating ? ` · ${a.rating}/5` : ''} · +${a.upvotes ?? 1} · ${a.status}${a.classement ? ` · ${a.classement}` : ''}] ${String(a.comment ?? '').replace(/\s+/g, ' ').slice(0, 300)}`).join('\n');
  const texte = `# Mise à jour évaluée : ${fiche.name} (${appId})
Version publiée sur alphabette.fr : ${base ?? 'aucune'} — version candidate (alphabette.eu) : ${tete ?? 'inconnue'}
${stats}
Avis du Laboratoire retenus : ${avis.length}${notes.length ? ` · note moyenne ${(notes.reduce((s, n) => s + n, 0) / notes.length).toFixed(1)}/5 sur ${notes.length} notes` : ''}

<donnees_non_fiables type="avis_utilisateurs">
${lignesAvis || '(aucun avis)'}
</donnees_non_fiables>

<donnees_non_fiables type="diff_git">
${diff || '(aucun diff disponible)'}
</donnees_non_fiables>
`;
  return { fiche, cle, base, tete, texte, nb_avis: avis.length };
}

/* ------------------------- Lecture et contrôle d'un avis ------------------------- */

function lireAvis(brut: string, qui: string): AvisAgent {
  const m = brut.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`${qui} : pas de JSON dans la réponse`);
  const a = JSON.parse(m[0]);
  const positions: Position[] = ['GO', 'GO_SOUS_CONDITIONS', 'NO_GO'];
  if (!positions.includes(a.position)) throw new Error(`${qui} : position invalide (${a.position})`);
  const note = Math.round(Number(a.note));
  if (!Number.isFinite(note) || note < 0 || note > 100) throw new Error(`${qui} : note invalide`);
  const liste = (x: unknown) => (Array.isArray(x) ? x.map(String).map((s) => s.slice(0, 300)).slice(0, 5) : []);
  return { position: a.position, note, resume: String(a.resume ?? '').slice(0, 220), arguments: liste(a.arguments), risques_bloquants: liste(a.risques_bloquants), conditions: liste(a.conditions) };
}

const unanime = (t: Record<IdAgent, AvisAgent>) => {
  const v = IDS.map((i) => t[i]);
  const memePosition = v.every((a) => (a.position === 'NO_GO') === (v[0].position === 'NO_GO'));
  return memePosition && Math.max(...v.map((a) => a.note)) - Math.min(...v.map((a) => a.note)) <= 20;
};

/* ------------------------- Décision ------------------------- */

function decider(appId: string, ctx: ReturnType<typeof contexte>, tours: Record<IdAgent, AvisAgent>[], moteur: string) {
  const final = tours[tours.length - 1];
  const notes = IDS.map((i) => final[i].note);
  const moyenne = notes.reduce((s, n) => s + n, 0) / notes.length;
  const ecart = Math.sqrt(notes.reduce((s, n) => s + (n - moyenne) ** 2, 0) / notes.length);
  const nonGo = IDS.filter((i) => final[i].position === 'NO_GO');
  const veto = final.securite.position === 'NO_GO' && final.securite.risques_bloquants.length > 0;
  const verdict: 'GO' | 'NO_GO' = veto || nonGo.length >= 2 || moyenne < 60 ? 'NO_GO' : 'GO';
  const alignes = IDS.filter((i) => (final[i].position === 'NO_GO') === (verdict === 'NO_GO')).length;
  const consensus = Math.max(0, Math.min(100, Math.round((alignes / IDS.length) * 100 - ecart)));
  const raison = veto ? 'veto de la Sécurité' : nonGo.length >= 2 ? `${nonGo.length} agents sur 3 contre` : moyenne < 60 ? `note moyenne ${Math.round(moyenne)}/100` : `note moyenne ${Math.round(moyenne)}/100`;
  const conditions = [...new Set(IDS.flatMap((i) => [...final[i].risques_bloquants, ...final[i].conditions]))];
  const libelle: Record<Position, string> = { GO: 'pour', GO_SOUS_CONDITIONS: 'pour sous conditions', NO_GO: 'contre' };
  const ligne = (i: IdAgent, nom: string) => `${nom} (${final[i].note}/100, ${libelle[final[i].position]}) : ${final[i].resume}`;
  const synthese = [
    `Verdict ${verdict} pour ${ctx.fiche.name} — consensus ${consensus}/100, ${tours.length} tour${tours.length > 1 ? 's' : ''}, ${raison}.`,
    ligne('produit', 'Produit'),
    ligne('securite', 'Sécurité'),
    ligne('simplicite', 'Simplicité'),
    conditions.length ? `À traiter : ${conditions.slice(0, 2).join(' ; ').slice(0, 260)}` : 'À traiter : rien de signalé par le Conseil.',
  ];
  const rapport = {
    app_id: appId, nom: ctx.fiche.name, evalue_le: new Date().toISOString(), moteur,
    version_publiee: ctx.base, version_candidate: ctx.tete, avis_pris_en_compte: ctx.nb_avis,
    verdict, note_consensus: consensus, veto_securite: veto, synthese_executive: synthese,
    conditions, tours: tours.map((t, n) => ({ tour: n + 1, avis: Object.fromEntries(IDS.map((i) => [i, { agent: AGENTS[i].nom, ...t[i] }])) })),
    regle_de_decision: 'Veto Sécurité (NO_GO + risque bloquant) ; sinon NO_GO si 2 agents contre ou moyenne < 60 ; consensus = % d’agents alignés − écart-type des notes.',
  };
  ecrire(path.join(RACINE, 'data/labo/conseil', `${appId}.json`), rapport);
  const tableau = lire<{ _aide?: string; apps: Record<string, unknown> }>(path.join(RACINE, 'data/labo/conseil.json'), { apps: {} });
  tableau._aide = "Dernière décision du Conseil des Agents par appli (tableau de bord d'administration). Détail : data/labo/conseil/<app_id>.json.";
  tableau.apps[appId] = { evalue_le: rapport.evalue_le, verdict, note_consensus: consensus, version_candidate: ctx.tete, synthese_executive: synthese };
  ecrire(path.join(RACINE, 'data/labo/conseil.json'), tableau);
  console.log(JSON.stringify({ verdict, note_consensus: consensus, synthese_executive: synthese }, null, 2));
  process.exitCode = verdict === 'GO' ? 0 : 1;
}

/* ------------------------- Moteur « api » ------------------------- */

function chaineEnv(): MaillonIA[] {
  const cles: Record<Fournisseur, string | undefined> = {
    mistral: process.env.MISTRAL_API_KEY, gemini: process.env.GEMINI_API_KEY, claude: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY, deepseek: process.env.DEEPSEEK_API_KEY, grok: process.env.XAI_API_KEY,
  };
  const ordre = (process.env.CONSEIL_CHAINE || 'mistral,gemini,claude,openai,deepseek,grok').split(',').map((s) => s.trim()) as Fournisseur[];
  return ordre.filter((f) => cles[f]).map((f) => ({ fournisseur: f, cle: cles[f]!, modele: process.env[`CONSEIL_MODELE_${f.toUpperCase()}`] || undefined }));
}

async function evaluerApi(appId: string) {
  const chaine = chaineEnv();
  if (!chaine.length) {
    console.error("Conseil : aucune clé d'IA dans l'environnement (MISTRAL_API_KEY…). Utiliser le moteur relais : preparer / poursuivre.");
    process.exit(2);
  }
  const ctx = contexte(appId);
  const demander = async (i: IdAgent, suite?: string) => {
    const r = await appelerIA({ systeme: AGENTS[i].systeme, json: true, temperature: 0.2, maxTokens: 1200,
      messages: [{ role: 'user', contenu: ctx.texte }, ...(suite ? [{ role: 'user' as const, contenu: suite }] : [])] },
      { chaine, onBascule: (b) => console.error(`↪ ${b.message}`) });
    return lireAvis(r.texte, AGENTS[i].nom);
  };
  const t1 = Object.fromEntries(await Promise.all(IDS.map(async (i) => [i, await demander(i)]))) as Record<IdAgent, AvisAgent>;
  const tours = [t1];
  if (!unanime(t1)) {
    const t2 = Object.fromEntries(await Promise.all(IDS.map(async (i) => [i, await demander(i, consigneTour2(i, IDS.filter((x) => x !== i).map((x) => ({ nom: AGENTS[x].nom, avis: t1[x] }))))]))) as Record<IdAgent, AvisAgent>;
    tours.push(t2);
  }
  decider(appId, ctx, tours, `api (${chaine.map((m) => m.fournisseur).join(' → ')})`);
}

/* ------------------------- Moteur « relais » (session Claude, sans clé) ------------------------- */

const dossierRelais = (appId: string) => path.join('/tmp/conseil', appId);

function ecrirePrompts(appId: string, tour: number, texte: string, suites?: Record<IdAgent, string>) {
  for (const i of IDS) {
    const f = path.join(dossierRelais(appId), `tour${tour}`, `${i}.prompt.md`);
    mkdirSync(path.dirname(f), { recursive: true });
    writeFileSync(f, `<!-- Conseil des Agents — ${AGENTS[i].nom} — tour ${tour}. Réponse attendue : JSON seul dans ${f.replace('.prompt.md', '.json')} -->\n\n## PROMPT SYSTÈME (ton rôle)\n${AGENTS[i].systeme}\n\n## CONTEXTE\n${texte}\n${suites ? `\n## ${suites[i]}\n` : ''}`);
  }
  console.log(JSON.stringify({ tour, a_faire: IDS.map((i) => ({ agent: i, prompt: path.join(dossierRelais(appId), `tour${tour}`, `${i}.prompt.md`), reponse: path.join(dossierRelais(appId), `tour${tour}`, `${i}.json`) })),
    ensuite: `bun scripts/labo/conseil/conseil.ts poursuivre ${appId}` }, null, 2));
}

function lireTour(appId: string, tour: number): Record<IdAgent, AvisAgent> | null {
  const t: Partial<Record<IdAgent, AvisAgent>> = {};
  for (const i of IDS) {
    const f = path.join(dossierRelais(appId), `tour${tour}`, `${i}.json`);
    if (!existsSync(f)) return null;
    t[i] = lireAvis(readFileSync(f, 'utf8'), AGENTS[i].nom);
  }
  return t as Record<IdAgent, AvisAgent>;
}

/* ------------------------- Commandes ------------------------- */

const [cmd, appId] = args;
if (!appId) { console.error('Usage : evaluer <app_id> --moteur api | preparer <app_id> | poursuivre <app_id>'); process.exit(2); }
if (cmd === 'evaluer') await evaluerApi(appId);
else if (cmd === 'preparer') {
  const ctx = contexte(appId);
  ecrire(path.join(dossierRelais(appId), 'contexte.json'), { base: ctx.base, tete: ctx.tete, nb_avis: ctx.nb_avis, nom: ctx.fiche.name });
  writeFileSync(path.join(dossierRelais(appId), 'contexte.md'), ctx.texte);
  ecrirePrompts(appId, 1, ctx.texte);
} else if (cmd === 'poursuivre') {
  const meta = lire<any>(path.join(dossierRelais(appId), 'contexte.json'), null);
  if (!meta) throw new Error('Lancer d’abord « preparer ».');
  const texte = readFileSync(path.join(dossierRelais(appId), 'contexte.md'), 'utf8');
  const ctx = { fiche: { name: meta.nom }, base: meta.base, tete: meta.tete, nb_avis: meta.nb_avis, texte } as ReturnType<typeof contexte>;
  const t1 = lireTour(appId, 1);
  if (!t1) throw new Error('Réponses du tour 1 incomplètes.');
  if (unanime(t1)) decider(appId, ctx, [t1], 'relais (session Claude)');
  else {
    const t2 = lireTour(appId, 2);
    if (t2) decider(appId, ctx, [t1, t2], 'relais (session Claude)');
    else ecrirePrompts(appId, 2, texte, Object.fromEntries(IDS.map((i) => [i, consigneTour2(i, IDS.filter((x) => x !== i).map((x) => ({ nom: AGENTS[x].nom, avis: t1[x] })))])) as Record<IdAgent, string>);
  }
} else { console.error('Commande inconnue'); process.exit(2); }
