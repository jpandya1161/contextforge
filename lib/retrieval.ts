import type { EmbeddingProvider, RetrievedChunk } from "./types";
import type { VectorStore } from "./vector-store";

export interface RetrievalOptions {
  k?: number;
  /** Minimum cosine similarity for the top result to be considered usable. */
  confidenceThreshold?: number;
}

export interface RetrievalResult {
  retrieved: RetrievedChunk[];
  /** Top-1 similarity score, used as the confidence signal. */
  confidence: number;
  /** True when confidence is below threshold or nothing was retrieved. */
  shouldAbstain: boolean;
}

// Tuned against eval/dataset.json (see eval/__tests__/golden-dataset.test.ts): high
// enough that the hashing embedder's occasional spurious-collision similarity on
// genuinely out-of-scope questions (e.g. "what's the CEO's cell number") falls
// below it and triggers an abstain, while staying low enough that legitimate
// answerable questions with modest lexical overlap still clear it.
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.215;
export const DEFAULT_TOP_K = 5;

/**
 * Embeds the query, retrieves the top-k nearest chunks, and applies the
 * confidence/abstain decision. This is the single choke point both the
 * chat API route and the eval harness go through, so the abstain policy is
 * guaranteed to be identical in both places.
 */
export async function retrieve(
  query: string,
  store: VectorStore,
  embeddingProvider: EmbeddingProvider,
  options: RetrievalOptions = {},
): Promise<RetrievalResult> {
  const k = options.k ?? DEFAULT_TOP_K;
  const threshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  const [queryEmbedding] = await embeddingProvider.embed([query]);
  const retrieved = await store.similaritySearch(queryEmbedding, k);
  const confidence = retrieved[0]?.score ?? 0;
  const shouldAbstain = retrieved.length === 0 || confidence < threshold;

  return { retrieved, confidence, shouldAbstain };
}
