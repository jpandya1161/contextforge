import { stem } from "./stemming";
import { STOPWORDS } from "./stopwords";
import type { EmbeddingProvider } from "./types";

/**
 * Tokenizes text into lowercase word + bigram tokens. Bigrams give the
 * hashing embedder some sensitivity to word order/phrases, not just a raw
 * bag-of-words, which materially improves retrieval quality for short docs.
 */
function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w))
    .map(stem);

  const tokens = [...words];
  for (let i = 0; i < words.length - 1; i++) {
    tokens.push(`${words[i]}_${words[i + 1]}`);
  }
  return tokens;
}

/** Small, deterministic 32-bit string hash (FNV-1a). */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * A feature-hashing TF-IDF embedder ("hashing trick" + inverse document
 * frequency): every token is hashed into a fixed-size vector, weighted by
 * log-scaled term frequency times inverse document frequency, with a sign
 * derived from a second hash to reduce collision bias, then L2-normalized.
 * This needs no external API, no GPU, and no network access, which makes it
 * the default "self-hosted, zero-cost" mode for ContextForge, and it is
 * what the test suite and CI run against.
 *
 * IDF statistics are *fitted* incrementally: every batch `embed()` call
 * with more than one text is treated as ingesting a set of corpus
 * documents and updates the running document-frequency table (this is how
 * ingestion calls it, one batch per source document's chunks). Single-text
 * calls (query embedding) only *use* the fitted statistics, they don't
 * perturb them -- mirroring the fit/transform split of a real TF-IDF
 * vectorizer. Without this, generic words that show up in most documents
 * (a product name, "settings", "plan") dominate every vector and retrieval
 * can't tell topics apart; with it, distinctive vocabulary ("webhook
 * signature", "backup codes") drives the match.
 *
 * It is not as semantically rich as a neural embedding model, but it is a
 * real, working retrieval signal: documents that share distinctive
 * vocabulary score measurably higher than unrelated ones, which is exactly
 * what the golden eval harness verifies.
 */
export class HashingEmbeddingProvider implements EmbeddingProvider {
  readonly name = "hashing-local";
  readonly dimensions: number;

  /** Number of "documents" (batch calls' items) seen so far, for IDF. */
  private totalDocs = 0;
  /** Hashed-bucket index -> number of documents containing that token. */
  private docFreq = new Map<number, number>();

  constructor(dimensions = 512) {
    this.dimensions = dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length > 1) {
      for (const text of texts) this.observe(text);
    }
    return texts.map((text) => this.embedOne(text));
  }

  /** Records token presence for IDF purposes ("fit" step). */
  private observe(text: string): void {
    this.totalDocs += 1;
    const seen = new Set<number>();
    for (const token of tokenize(text)) {
      seen.add(fnv1a(token) % this.dimensions);
    }
    for (const bucket of seen) {
      this.docFreq.set(bucket, (this.docFreq.get(bucket) ?? 0) + 1);
    }
  }

  private idf(bucket: number): number {
    if (this.totalDocs === 0) return 1;
    const df = this.docFreq.get(bucket) ?? 0;
    return Math.log((this.totalDocs + 1) / (df + 1)) + 1;
  }

  private embedOne(text: string): number[] {
    const vector = new Array(this.dimensions).fill(0);
    const tokens = tokenize(text);
    if (tokens.length === 0) return vector;

    const counts = new Map<string, number>();
    for (const token of tokens) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }

    for (const [token, count] of counts) {
      const h = fnv1a(token);
      const index = h % this.dimensions;
      const sign = fnv1a(`sign:${token}`) % 2 === 0 ? 1 : -1;
      const tf = 1 + Math.log(count);
      const weight = sign * tf * this.idf(index);
      vector[index] += weight;
    }

    return normalize(vector);
  }

  /** Resets fitted IDF statistics (mainly useful for isolating tests). */
  reset(): void {
    this.totalDocs = 0;
    this.docFreq.clear();
  }
}

function normalize(vector: number[]): number[] {
  let sumSq = 0;
  for (const v of vector) sumSq += v * v;
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}

/**
 * Wraps OpenAI's embeddings API (text-embedding-3-small, 1536 dims). Used in
 * production when `OPENAI_API_KEY` is configured. Never touched by unit
 * tests -- exercising this class requires network access and a paid key.
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai:text-embedding-3-small";
  readonly dimensions = 1536;

  constructor(private readonly apiKey: string, private readonly model = "text-embedding-3-small") {
    if (!apiKey) throw new Error("OpenAIEmbeddingProvider requires an API key");
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI embeddings request failed (${res.status}): ${body}`);
    }
    const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
    return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}

/**
 * Selects the embedding provider from environment configuration. Falls back
 * to the free hashing embedder when no `OPENAI_API_KEY` is present, which is
 * the expected/supported "cheap and self-hostable" deployment mode.
 */
export function getDefaultEmbeddingProvider(): EmbeddingProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) return new OpenAIEmbeddingProvider(apiKey);
  return new HashingEmbeddingProvider();
}

let sharedEmbeddingProvider: EmbeddingProvider | null = null;

/**
 * Process-wide singleton embedding provider used by the API routes. This
 * matters beyond avoiding re-allocation: `HashingEmbeddingProvider` fits
 * IDF statistics from the documents it has embedded, so ingestion and
 * querying must go through the *same* instance for retrieval to see the
 * fitted corpus statistics.
 */
export function getSharedEmbeddingProvider(): EmbeddingProvider {
  if (!sharedEmbeddingProvider) sharedEmbeddingProvider = getDefaultEmbeddingProvider();
  return sharedEmbeddingProvider;
}
