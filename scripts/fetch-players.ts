/**
 * @file fetch-players.ts
 * Extraction des grands joueurs (Football & NBA) depuis Wikidata (SPARQL)
 * avec leurs photos Wikimedia Commons et leurs années de carrière.
 *
 * Usage : bun run fetch:players
 * Sortie : data/players.json
 *
 * Contraintes techniques (le service SPARQL de Wikidata coupe à 60 s) :
 *   - `SERVICE wikibase:label` combiné à un balayage large fait expirer la requête :
 *     les libellés sont donc demandés séparément, sur un lot d'identifiants (VALUES).
 *   - aucun tri global coûteux : la découverte s'appuie sur l'article Wikipédia FR
 *     et sur des fenêtres d'année de naissance.
 *
 * Pipeline par univers :
 *   1. Découverte large (article Wikipédia FR + photo) par fenêtres de naissance.
 *   2. Classement par notoriété (nombre de versions linguistiques Wikipédia = « classement standard »).
 *   3. Détail du top 300 : libellés et années de carrière (P2031/P2032).
 *   4. Contrôle qualité sportif : écarte les personnalités seulement « accessoirement »
 *      footballeuses (Albert Camus, Sean Connery, Viktor Orbán… tous référencés comme
 *      footballeurs amateurs par Wikidata).
 *   5. Années de carrière élargies grâce aux clubs fréquentés (P54 + qualificatifs).
 *   6. Conservation des 200 meilleurs joueurs par univers.
 *
 * Sources : Wikidata (CC0) et Wikimedia Commons (licences libres, crédit à la source).
 */

import fs from "fs";
import path from "path";

/** Univers sportifs de l'application (aligné sur src/goat/sports.tsx). */
export type SportId = "football" | "nba";

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const OUTPUT_PATH = path.join(process.cwd(), "data", "players.json");
const TARGET_PER_SPORT = 200;
const SURPLUS_PER_SPORT = 300;
const THUMBNAIL_WIDTH = 300;
const LIMIT_PER_WINDOW = 1200;
const VALUES_BATCH = 300;
const USER_AGENT =
  "AlphabetteGoatChevreTheKing/1.0 (https://alphabette.fr/goat; contact@alphabette.fr)";

interface RawBinding {
  [key: string]: { value: string } | undefined;
}

interface SparqlResponse {
  results: { bindings: RawBinding[] };
}

export interface GoatPlayer {
  id: string;
  name: string;
  sport: SportId;
  image: string;
  commonsUrl: string;
  startYear: number | null;
  endYear: number | null;
  /** Années formatées : « 1998 - 2006 » ou « 2003 - Présent ». */
  career: string;
  /** Nombre de versions linguistiques Wikipédia = notoriété (classement standard). */
  fame: number;
}

interface Candidate {
  id: string;
  name: string;
  image: string;
  fame: number;
  startYear: number | null;
  endYear: number | null;
}

/** Fenêtres d'années de naissance : couvre toutes les époques de façon homogène. */
const BIRTH_WINDOWS: Array<[number, number]> = [
  [1900, 1940],
  [1940, 1955],
  [1955, 1970],
  [1970, 1980],
  [1980, 1988],
  [1988, 2005],
];

/** Occupation Wikidata (+ ligue NBA pour le basketball). */
const SPORT_PATTERNS: Record<SportId, string> = {
  football: `?player wdt:P106 wd:Q937857 .`,
  nba: `?player wdt:P106 wd:Q3665646 ; wdt:P118 wd:Q155223 .`,
};

/** Métiers liés au sport : tout le reste compte comme « autre métier ». */
const SPORT_OCCUPATIONS = new Set([
  "Q937857", // footballeur
  "Q3665646", // basketteur
  "Q628099", // entraîneur de football
  "Q2066131", // sportif
  "Q27503001", // athlète professionnel
  "Q18515558", // joueur de futsal
  "Q21057452", // joueur de beach soccer
]);

/** Nombre maximum d'autres métiers tolérés quand le signal sportif est faible. */
const MAX_OTHER_OCCUPATIONS = 3;

/**
 * Découverte : article Wikipédia FR + photo + date de naissance dans la fenêtre.
 * Requête volontairement légère (pas de libellés, pas de tri global).
 */
const buildDiscoveryQuery = (sport: SportId, fromYear: number, toYear: number): string => `
PREFIX schema: <http://schema.org/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT DISTINCT ?player ?image WHERE {
  ?article schema:about ?player ;
           schema:isPartOf <https://fr.wikipedia.org/> .
  ${SPORT_PATTERNS[sport]}
  ?player wdt:P18 ?image ;
          wdt:P569 ?dob .
  FILTER(?dob >= "${fromYear}-01-01T00:00:00Z"^^xsd:dateTime && ?dob < "${toYear}-01-01T00:00:00Z"^^xsd:dateTime)
}
LIMIT ${LIMIT_PER_WINDOW}
`;

/** Notoriété seule : très peu coûteux, sert au classement des candidats. */
const buildFameQuery = (qids: string[]): string => `
SELECT ?player ?links WHERE {
  VALUES ?player { ${qids.map((qid) => `wd:${qid}`).join(" ")} }
  ?player wikibase:sitelinks ?links .
}
`;

/** Détail du top : libellés et années de carrière déclarées. */
const buildDetailsQuery = (qids: string[]): string => `
SELECT ?player ?playerLabel (MIN(?startYear) AS ?start) (MAX(?endYear) AS ?end) WHERE {
  VALUES ?player { ${qids.map((qid) => `wd:${qid}`).join(" ")} }
  OPTIONAL { ?player wdt:P2031 ?workStart . BIND(YEAR(?workStart) AS ?startYear) }
  OPTIONAL { ?player wdt:P2032 ?workEnd . BIND(YEAR(?workEnd) AS ?endYear) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
GROUP BY ?player ?playerLabel
`;

/** Métiers déclarés (contrôle qualité sportif). */
const buildOccupationQuery = (qids: string[]): string => `
SELECT ?player ?occupation WHERE {
  VALUES ?player { ${qids.map((qid) => `wd:${qid}`).join(" ")} }
  ?player wdt:P106 ?occupation .
}
`;

/** Clubs fréquentés et postes de jeu déclarés (signal sportif fort). */
const buildTeamStatsQuery = (qids: string[]): string => `
SELECT ?player (COUNT(DISTINCT ?team) AS ?teams) (COUNT(DISTINCT ?position) AS ?positions) WHERE {
  VALUES ?player { ${qids.map((qid) => `wd:${qid}`).join(" ")} }
  OPTIONAL { ?player p:P54/ps:P54 ?team }
  OPTIONAL { ?player p:P413/ps:P413 ?position }
}
GROUP BY ?player
`;

/**
 * Années de carrière déduites des clubs (P54).
 * `?openStart` = début de l'affiliation en cours (aucune date de fin) : sert à repérer
 * les carrières déclarées comme terminées alors qu'elles se poursuivent encore.
 */
const buildCareerQuery = (qids: string[]): string => `
SELECT ?player (MIN(YEAR(?start)) AS ?start) (MAX(YEAR(?end)) AS ?end) (MAX(YEAR(?openStart)) AS ?openStartYear) (MIN(?birthYear) AS ?birth) WHERE {
  VALUES ?player { ${qids.map((qid) => `wd:${qid}`).join(" ")} }
  OPTIONAL { ?player wdt:P569 ?birthDate . BIND(YEAR(?birthDate) AS ?birthYear) }
  OPTIONAL { ?player p:P54 [ ps:P54 ?team ; pq:P580 ?start ] . }
  OPTIONAL { ?player p:P54 [ ps:P54 ?teamEnd ; pq:P582 ?end ] . }
  OPTIONAL {
    ?player p:P54 ?openStatement .
    ?openStatement ps:P54 ?openTeam ;
                   pq:P580 ?openStart .
    FILTER NOT EXISTS { ?openStatement pq:P582 ?openEnd }
  }
}
GROUP BY ?player
`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Exécution SPARQL avec temporisation respectueuse et reprise sur 429 / 5xx. */
async function runSparql(query: string, attempt = 1): Promise<RawBinding[]> {
  try {
    const response = await fetch(SPARQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
        "User-Agent": USER_AGENT,
      },
      body: new URLSearchParams({ query }).toString(),
    });

    if (!response.ok) {
      const retryable = [429, 500, 502, 503, 504].includes(response.status);
      throw Object.assign(new Error(`HTTP ${response.status} ${response.statusText}`), {
        retryable,
        rateLimited: response.status === 429,
      });
    }

    const payload = (await response.json()) as SparqlResponse;
    return payload.results?.bindings ?? [];
  } catch (err: any) {
    if (attempt >= 5 || err?.retryable === false) throw err;
    const delay = err?.rateLimited ? 20_000 * attempt : 2_500 * attempt;
    console.warn(`   ↳ ${err.message} — nouvelle tentative dans ${Math.round(delay / 1000)}s…`);
    await sleep(delay);
    return runSparql(query, attempt + 1);
  }
}

/**
 * Variante tolérante : un lot qui échoue définitivement est signalé puis ignoré,
 * afin qu'une erreur passagère du service Wikidata n'annule pas toute l'extraction.
 */
async function runSparqlSafe(query: string, label: string): Promise<RawBinding[]> {
  try {
    return await runSparql(query);
  } catch (err: any) {
    console.warn(`   ⚠ lot ignoré (${label}) : ${err?.message}`);
    return [];
  }
}

/** URL Wikidata « Special:FilePath » -> vignette Wikimedia de 300 px. */
export function toThumbnail(filePathUrl: string, width = THUMBNAIL_WIDTH): string {
  const fileName = decodeURIComponent(filePathUrl.split("Special:FilePath/")[1] ?? "");
  if (!fileName) return "";
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=${width}`;
}

/** Page Commons du fichier (crédit / licence de la photo). */
export function toCommonsPage(filePathUrl: string): string {
  const fileName = decodeURIComponent(filePathUrl.split("Special:FilePath/")[1] ?? "");
  if (!fileName) return "";
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName)}`;
}

/** Formate les années : « 1998 - 2006 », « 2003 - Présent ». */
export function formatCareer(startYear: number | null, endYear: number | null): string {
  const currentYear = new Date().getFullYear();

  if (startYear && endYear) {
    // Fin de carrière très récente : le joueur est toujours en activité.
    if (endYear >= currentYear - 1) return `${startYear} - Présent`;
    return startYear === endYear ? `${startYear}` : `${startYear} - ${endYear}`;
  }
  if (startYear) return `${startYear} - Présent`;
  if (endYear) return `Jusqu'en ${endYear}`;
  return "Carrière non renseignée";
}

const toYear = (value?: string): number | null => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 1800 && parsed < 2100 ? parsed : null;
};

const isYear = (value: number | null): value is number => value !== null;

const qidOf = (binding: RawBinding, key: string): string | null =>
  binding[key]?.value?.split("/").pop() ?? null;

/** Étape 1 : découverte large des candidats par fenêtres de naissance. */
async function discoverCandidates(sport: SportId): Promise<Map<string, string>> {
  const candidates = new Map<string, string>();

  for (const [fromYear, toYear] of BIRTH_WINDOWS) {
    const bindings = await runSparqlSafe(
      buildDiscoveryQuery(sport, fromYear, toYear),
      `découverte ${fromYear}-${toYear}`,
    );
    let added = 0;

    for (const binding of bindings) {
      const qid = qidOf(binding, "player");
      const image = binding.image?.value;
      if (!qid || !image || candidates.has(qid)) continue;
      candidates.set(qid, image);
      added += 1;
    }

    console.log(`   · fenêtre ${fromYear}-${toYear} : +${added} (total ${candidates.size})`);
    await sleep(1000);
  }

  return candidates;
}

/** Étape 2 : notoriété des candidats (nombre de versions linguistiques Wikipédia). */
async function fetchFame(qids: string[]): Promise<Map<string, number>> {
  const fame = new Map<string, number>();

  for (let index = 0; index < qids.length; index += VALUES_BATCH) {
    const batch = qids.slice(index, index + VALUES_BATCH);
    const bindings = await runSparqlSafe(buildFameQuery(batch), `notoriété ${index}`);

    for (const binding of bindings) {
      const qid = qidOf(binding, "player");
      if (!qid) continue;
      fame.set(qid, Number.parseInt(binding.links?.value ?? "0", 10) || 0);
    }

    if (index % 1500 === 0) console.log(`   · notoriété ${Math.min(index + batch.length, qids.length)}/${qids.length}`);
    await sleep(700);
  }

  return fame;
}

/** Étape 3 : libellés et années de carrière déclarées du top des candidats. */
async function fetchDetails(qids: string[]): Promise<Map<string, { name: string; startYear: number | null; endYear: number | null }>> {
  const details = new Map<string, { name: string; startYear: number | null; endYear: number | null }>();

  for (let index = 0; index < qids.length; index += VALUES_BATCH) {
    const batch = qids.slice(index, index + VALUES_BATCH);
    const bindings = await runSparqlSafe(buildDetailsQuery(batch), `détails ${index}`);

    for (const binding of bindings) {
      const qid = qidOf(binding, "player");
      const name = binding.playerLabel?.value?.trim();
      if (!qid || !name || name.startsWith("Q")) continue;
      details.set(qid, {
        name,
        startYear: toYear(binding.start?.value),
        endYear: toYear(binding.end?.value),
      });
    }

    await sleep(900);
  }

  return details;
}

/** Étape 4 : métiers déclarés (contrôle qualité sportif). */
async function fetchOccupations(qids: string[]): Promise<Map<string, string[]>> {
  const occupations = new Map<string, string[]>();

  for (let index = 0; index < qids.length; index += VALUES_BATCH) {
    const batch = qids.slice(index, index + VALUES_BATCH);
    const bindings = await runSparqlSafe(buildOccupationQuery(batch), `métiers ${index}`);

    for (const binding of bindings) {
      const qid = qidOf(binding, "player");
      const occupation = qidOf(binding, "occupation");
      if (!qid || !occupation) continue;
      const list = occupations.get(qid) ?? [];
      if (!list.includes(occupation)) list.push(occupation);
      occupations.set(qid, list);
    }

    await sleep(900);
  }

  return occupations;
}

/** Étape 4 bis : clubs et postes déclarés (signal sportif fort). */
async function fetchTeamStats(qids: string[]): Promise<Map<string, { teams: number; positions: number }>> {
  const stats = new Map<string, { teams: number; positions: number }>();

  for (let index = 0; index < qids.length; index += VALUES_BATCH) {
    const batch = qids.slice(index, index + VALUES_BATCH);
    const bindings = await runSparqlSafe(buildTeamStatsQuery(batch), `clubs ${index}`);

    for (const binding of bindings) {
      const qid = qidOf(binding, "player");
      if (!qid) continue;
      stats.set(qid, {
        teams: Number.parseInt(binding.teams?.value ?? "0", 10) || 0,
        positions: Number.parseInt(binding.positions?.value ?? "0", 10) || 0,
      });
    }

    await sleep(900);
  }

  return stats;
}

/** Étape 5 : élargit les années de carrière grâce aux clubs fréquentés. */
async function widenCareers(players: GoatPlayer[]): Promise<void> {
  if (players.length === 0) return;

  const byId = new Map(players.map((player) => [player.id, player]));
  const stillActive: string[] = [];

  for (let index = 0; index < players.length; index += VALUES_BATCH) {
    const batch = players.slice(index, index + VALUES_BATCH);
    const bindings = await runSparqlSafe(
      buildCareerQuery(batch.map((player) => player.id)),
      `carrières ${index}`,
    );

    for (const binding of bindings) {
      const qid = qidOf(binding, "player");
      const player = qid ? byId.get(qid) : undefined;
      if (!player) continue;

      const startYear = toYear(binding.start?.value);
      const endYear = toYear(binding.end?.value);
      const openStartYear = toYear(binding.openStartYear?.value);
      const birthYear = toYear(binding.birth?.value);

      // On élargit seulement : données de clubs utilisées si absentes ou trop restrictives.
      if (isYear(startYear) && (!isYear(player.startYear) || startYear < player.startYear)) {
        player.startYear = startYear;
      }
      if (isYear(endYear) && (!isYear(player.endYear) || endYear > player.endYear)) {
        player.endYear = endYear;
      }

      // Une affiliation en cours a démarré après une fin de carrière déclarée à un âge
      // impossible (moins de 30 ans) : la date de fin est périmée et le joueur est
      // toujours en activité (ex. Stephen Curry, dont la « période d'activité » s'arrête
      // à ses années universitaires).
      const retiredTooYoung =
        isYear(birthYear) &&
        isYear(openStartYear) &&
        isYear(player.endYear) &&
        openStartYear >= player.endYear &&
        player.endYear - birthYear < 30;

      if (retiredTooYoung) {
        player.startYear = isYear(player.startYear)
          ? Math.max(player.startYear, openStartYear)
          : openStartYear;
        player.endYear = null;
        stillActive.push(`${player.name} (né en ${birthYear})`);
      }

      player.career = formatCareer(player.startYear, player.endYear);
    }

    await sleep(900);
  }

  if (stillActive.length > 0) {
    console.log(`   · carrières considérées comme en cours : ${stillActive.length} (${stillActive.join(", ")})`);
  }
}

/** Pipeline d'un univers : découverte → notoriété → détail → contrôle qualité → top 200. */
async function collectSport(sport: SportId): Promise<GoatPlayer[]> {
  console.log(`\n→ Univers ${sport === "football" ? "Football International" : "Basketball NBA"}`);

  const candidates = await discoverCandidates(sport);
  const fame = await fetchFame([...candidates.keys()]);

  const topIds = [...candidates.keys()]
    .sort((a, b) => (fame.get(b) ?? 0) - (fame.get(a) ?? 0))
    .slice(0, SURPLUS_PER_SPORT);

  const details = await fetchDetails(topIds);

  const ranked: Candidate[] = topIds
    .map((id) => {
      const detail = details.get(id);
      const image = candidates.get(id);
      if (!detail || !image) return null;
      return {
        id,
        name: detail.name,
        image,
        fame: fame.get(id) ?? 0,
        startYear: detail.startYear,
        endYear: detail.endYear,
      } satisfies Candidate;
    })
    .filter((candidate): candidate is Candidate => candidate !== null);

  // Contrôle qualité : uniquement des profils réellement sportifs.
  const occupations = await fetchOccupations(ranked.map((candidate) => candidate.id));
  const teamStats = await fetchTeamStats(ranked.map((candidate) => candidate.id));

  const isSportsperson = (candidate: Candidate): boolean => {
    const stats = teamStats.get(candidate.id) ?? { teams: 0, positions: 0 };

    // Signal fort : au moins deux affiliations sportives.
    if (stats.teams >= 2) return true;

    // Signal faible : un poste déclaré, à condition d'un profil quasi exclusivement sportif.
    if (stats.positions >= 1) {
      const listed = occupations.get(candidate.id) ?? [];
      const otherOccupations = listed.filter((occupation) => !SPORT_OCCUPATIONS.has(occupation));
      return otherOccupations.length <= MAX_OTHER_OCCUPATIONS;
    }

    return false;
  };

  const legitimate = ranked.filter(isSportsperson);
  const rejected = ranked.filter((candidate) => !isSportsperson(candidate));
  console.log(
    `   · profils écartés (contrôle qualité sportif) : ${rejected.length}` +
      (rejected.length > 0 ? ` — ${rejected.map((candidate) => candidate.name).join(", ")}` : ""),
  );

  const players: GoatPlayer[] = legitimate.slice(0, TARGET_PER_SPORT).map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    sport,
    image: toThumbnail(candidate.image),
    commonsUrl: toCommonsPage(candidate.image),
    startYear: candidate.startYear,
    endYear: candidate.endYear,
    career: formatCareer(candidate.startYear, candidate.endYear),
    fame: candidate.fame,
  }));

  await widenCareers(players);
  return players;
}

async function main(): Promise<void> {
  console.log("🐐 Goat Chèvre The King — extraction des joueurs depuis Wikidata");

  const football = await collectSport("football");
  const nba = await collectSport("nba");
  const all = [...football, ...nba].sort((a, b) => b.fame - a.fame || a.name.localeCompare(b.name, "fr"));

  const counts = { football: football.length, nba: nba.length, total: all.length };

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "Wikidata SPARQL (https://query.wikidata.org/sparql) + Wikimedia Commons",
    license:
      "Données Wikidata : CC0. Photos : Wikimedia Commons, licences libres — crédit obligatoire selon la licence de chaque fichier (voir commonsUrl).",
    method:
      "Découverte par fenêtres de naissance (article Wikipédia FR + photo), classement par notoriété (nombre de versions linguistiques Wikipédia), détail P2031/P2032, contrôle qualité sportif (≥ 2 clubs, sinon poste déclaré et profil quasi exclusivement sportif), années élargies par les clubs P54, puis conservation des 200 meilleurs par univers.",
    thumbnailWidth: THUMBNAIL_WIDTH,
    counts,
    players: all,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");

  const withCareer = all.filter((player) => isYear(player.startYear)).length;
  console.log(`\n✅ ${counts.total} joueurs écrits dans data/players.json`);
  console.log(`   Football : ${counts.football} · NBA : ${counts.nba}`);
  console.log(`   Années de carrière renseignées : ${withCareer}/${counts.total}`);
  console.log(`   Top 5 : ${all.slice(0, 5).map((player) => `${player.name} (${player.fame})`).join(", ")}`);
}

const isDirectRun =
  (import.meta as { main?: boolean }).main === true ||
  (process.argv[1] ?? "").includes("fetch-players");

if (isDirectRun) {
  main().catch((err) => {
    console.error("❌ Échec de l'extraction :", err);
    process.exit(1);
  });
}
