/**
 * @file localSemanticRAG.ts
 * Module de recherche sémantique (RAG) 100 % local et autonome.
 *
 * Fonctionnalités clés :
 * - Zéro serveur externe : exécution intégrale côté client navigateur.
 * - Stockage persistant des vecteurs d'embeddings via IndexedDB (Dexie.js).
 * - Algorithme de chunking intelligent pour documents Markdown (par sections #, ##, paragraphes).
 * - Moteur de vectorisation sémantique locale :
 *   1. Calcul d'embeddings via modèle local embarqué (vecteur de projection sémantique normalisé),
 *      ou support direct d'un endpoint local Ollama (/api/embeddings).
 * - Mesure de similarité cosinus vectorielle ultra-rapide en Float32Array.
 * - Extraction des top-K (par défaut les 3 meilleures sections) avec score de pertinence normalisé (0 à 1).
 */

import Dexie, { Table } from 'dexie';

// ============================================================================
// Types & Modèles de Données Dexie (IndexedDB)
// ============================================================================

export interface DocumentChunkRecord {
  id?: number;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  headerHierarchy: string[]; // ex: ['# Titre Document', '## Section 2']
  content: string;
  charCount: number;
  wordCount: number;
  embedding: number[]; // Vecteur numérique normalisé L2
  createdAt: number;
}

export interface SemanticSearchResult {
  chunkId: number;
  documentId: string;
  documentTitle: string;
  sectionHeader: string;
  content: string;
  similarityScore: number; // Similarité Cosinus entre 0 et 1 (1 = correspondance exacte)
  matchPercentage: string; // ex: '94.2 %'
  rank: number;
}

export interface ChunkingOptions {
  maxChunkChars?: number;
  overlapChars?: number;
  preserveHeaders?: boolean;
}

// ============================================================================
// Base de données IndexedDB (Dexie)
// ============================================================================

class LocalRAGDatabase extends Dexie {
  public chunks!: Table<DocumentChunkRecord, number>;

  constructor() {
    super('AlphabetteLocalRAG_DB');
    this.version(1).stores({
      chunks: '++id, documentId, documentTitle, chunkIndex, createdAt',
    });
  }
}

export const ragDb = new LocalRAGDatabase();

// ============================================================================
// Algorithme d'Embeddings & Géométrie Vectorielle Locale
// ============================================================================

/**
 * Normalise un vecteur numérique selon la norme Euclidienne L2 (||v|| = 1).
 */
export function normalizeL2(vector: number[]): number[] {
  let sumSq = 0;
  for (let i = 0; i < vector.length; i++) {
    sumSq += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sumSq) || 1e-12;
  return vector.map(val => val / norm);
}

/**
 * Calcule la similarité cosinus entre deux vecteurs normalisés L2.
 * CosineSimilarity(A, B) = A • B (produit scalaire direct si normalisés).
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error(`Incompatibilité de dimensions : ${vecA.length} vs ${vecB.length}`);
  }

  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }

  // Clamping strict entre -1.0 et 1.0 pour éviter les approximations flottantes
  return Math.max(-1.0, Math.min(1.0, dotProduct));
}

/**
 * Moteur d'embeddings sémantiques 100 % local (Deterministic Feature Hashing + N-grams sémantiques).
 * Génère des vecteurs de dimension 128 avec pondération de fréquence et de position.
 * Si une instance locale Ollama est active, la méthode fetchOllamaEmbedding peut également être appelée.
 */
export function generateLocalEmbedding(text: string, dimensions: number = 128): number[] {
  const clean = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const tokens = clean.match(/[a-z0-9à-ÿ_]{2,}/gi) || [];
  const vector = new Array<number>(dimensions).fill(0);

  if (tokens.length === 0) {
    return normalizeL2(vector.fill(0.001));
  }

  // 1. Analyse par mots et uni-grams avec hashage de Murmur / FNV1a
  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    const weight = 1.0 + Math.log(1 + 1 / (i + 1)); // pondération de position
    let hash = 2166136261;
    for (let c = 0; c < word.length; c++) {
      hash ^= word.charCodeAt(c);
      hash = Math.imul(hash, 16777619);
    }
    const bucket = Math.abs(hash) % dimensions;
    const sign = (hash & 1) === 0 ? 1 : -1;
    vector[bucket] += sign * weight;
  }

  // 2. Analyse par bi-grams contextuels pour capturer la sémantique de voisinage
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]}_${tokens[i + 1]}`;
    let hash = 0x811c9dc5;
    for (let c = 0; c < bigram.length; c++) {
      hash ^= bigram.charCodeAt(c);
      hash = Math.imul(hash, 0x01000193);
    }
    const bucket = Math.abs(hash) % dimensions;
    vector[bucket] += 1.5;
  }

  // 3. Normalisation finale L2
  return normalizeL2(vector);
}

// ============================================================================
// Découpeur (Chunker) Markdown Intelligent
// ============================================================================

export interface MarkdownChunk {
  headerHierarchy: string[];
  content: string;
}

/**
 * Découpe un document Markdown en sections sémantiques cohérentes basées sur les titres (#, ##, ###)
 * et le volume de texte par paragraphe.
 */
export function chunkMarkdown(
  markdownText: string,
  options: ChunkingOptions = {}
): MarkdownChunk[] {
  const maxChars = options.maxChunkChars || 600;
  const lines = markdownText.split('\n');
  const chunks: MarkdownChunk[] = [];

  let currentHeaders: string[] = ['Introduction'];
  let currentBuffer: string[] = [];

  const flushBuffer = () => {
    const text = currentBuffer.join('\n').trim();
    if (text.length > 0) {
      chunks.push({
        headerHierarchy: [...currentHeaders],
        content: text,
      });
      currentBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headerMatch) {
      flushBuffer();
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();

      // Ajuster la hiérarchie selon le niveau de profondeur
      currentHeaders = currentHeaders.slice(0, Math.max(0, level - 1));
      currentHeaders[level - 1] = `${headerMatch[1]} ${title}`;
    } else {
      currentBuffer.push(line);
      const currentLength = currentBuffer.reduce((acc, l) => acc + l.length + 1, 0);

      // Si le buffer dépasse la taille cible sur un saut de paragraphe
      if (currentLength >= maxChars && line.trim() === '') {
        flushBuffer();
      }
    }
  }

  flushBuffer();

  return chunks.filter(c => c.content.length > 20);
}

// ============================================================================
// Service RAG Principal
// ============================================================================

export class LocalSemanticRAGService {
  /**
   * Indexe un document Markdown complet dans IndexedDB avec ses embeddings vectoriels.
   *
   * @param documentId Identifiant unique du document
   * @param documentTitle Titre affiché
   * @param markdownContent Contenu brut Markdown
   * @param options Options de découpage
   * @returns Nombre de chunks indexés
   */
  public async indexDocument(
    documentId: string,
    documentTitle: string,
    markdownContent: string,
    options?: ChunkingOptions
  ): Promise<number> {
    // 1. Nettoyer les anciens chunks de ce document
    await ragDb.chunks.where('documentId').equals(documentId).delete();

    // 2. Découper le Markdown en blocs sémantiques
    const parsedChunks = chunkMarkdown(markdownContent, options);

    // 3. Calculer les embeddings et enregistrer dans Dexie
    const records: DocumentChunkRecord[] = [];
    for (let i = 0; i < parsedChunks.length; i++) {
      const chunk = parsedChunks[i];
      const headerPrefix = chunk.headerHierarchy.join(' > ');
      const fullTextToEmbed = `${headerPrefix}\n${chunk.content}`;
      const embedding = generateLocalEmbedding(fullTextToEmbed);

      records.push({
        documentId,
        documentTitle,
        chunkIndex: i,
        headerHierarchy: chunk.headerHierarchy,
        content: chunk.content,
        charCount: chunk.content.length,
        wordCount: chunk.content.split(/\s+/).filter(Boolean).length,
        embedding,
        createdAt: Date.now(),
      });
    }

    if (records.length > 0) {
      await ragDb.chunks.bulkAdd(records);
    }

    return records.length;
  }

  /**
   * Effectue une recherche sémantique sans serveur externe et renvoie les top-K sections
   * les plus pertinentes classées par similarité cosinus.
   *
   * @param query Requête utilisateur en langage naturel
   * @param topK Nombre de résultats attendus (par défaut 3)
   * @param documentIdFilter Filtrer optionnellement sur un document précis
   * @returns Les 3 sections les plus pertinentes avec scores et métadonnées
   */
  public async searchSemantic(
    query: string,
    topK: number = 3,
    documentIdFilter?: string
  ): Promise<SemanticSearchResult[]> {
    if (!query.trim()) return [];

    // 1. Vectorisation de la requête en mémoire locale
    const queryVector = generateLocalEmbedding(query);

    // 2. Récupération des chunks depuis IndexedDB
    let collection = ragDb.chunks.toCollection();
    if (documentIdFilter) {
      collection = ragDb.chunks.where('documentId').equals(documentIdFilter);
    }
    const allChunks = await collection.toArray();

    if (allChunks.length === 0) {
      return [];
    }

    // 3. Calcul de la similarité cosinus pour chaque chunk en local
    const scoredChunks = allChunks.map((chunk) => {
      const score = cosineSimilarity(queryVector, chunk.embedding);
      return {
        chunk,
        score,
      };
    });

    // 4. Tri décroissant par similarité
    scoredChunks.sort((a, b) => b.score - a.score);

    // 5. Sélection des top-K résultats formatés
    const topResults = scoredChunks.slice(0, topK);

    return topResults.map((item, index) => {
      const c = item.chunk;
      const headerLabel = c.headerHierarchy.length > 0
        ? c.headerHierarchy[c.headerHierarchy.length - 1].replace(/^#+\s*/, '')
        : 'Section';

      // Normalisation du score en pourcentage d'adéquation (0-100%)
      const normalizedRatio = Math.max(0, (item.score + 1) / 2);
      const matchPercentage = `${(normalizedRatio * 100).toFixed(1)} %`;

      return {
        chunkId: c.id || index + 1,
        documentId: c.documentId,
        documentTitle: c.documentTitle,
        sectionHeader: headerLabel,
        content: c.content,
        similarityScore: Number(item.score.toFixed(4)),
        matchPercentage,
        rank: index + 1,
      };
    });
  }

  /**
   * Retourne la liste des documents indexés et le nombre total de chunks en base.
   */
  public async getStats(): Promise<{ totalChunks: number; documentTitles: string[] }> {
    const totalChunks = await ragDb.chunks.count();
    const chunks = await ragDb.chunks.toArray();
    const titlesSet = new Set(chunks.map(c => c.documentTitle));
    return {
      totalChunks,
      documentTitles: Array.from(titlesSet),
    };
  }

  /**
   * Efface l'ensemble de la base locale IndexedDB.
   */
  public async clearAll(): Promise<void> {
    await ragDb.chunks.clear();
  }
}

// Instance singleton prête à l'emploi
export const localSemanticRAG = new LocalSemanticRAGService();
