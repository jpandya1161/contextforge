import { cosineSimilarity } from "./similarity";
import type { EmbeddedChunk, RetrievedChunk } from "./types";

export interface VectorStore {
  upsert(chunks: EmbeddedChunk[]): Promise<void>;
  similaritySearch(queryEmbedding: number[], k: number): Promise<RetrievedChunk[]>;
  deleteByDocumentId(documentId: string): Promise<void>;
  count(): Promise<number>;
  all(): Promise<EmbeddedChunk[]>;
}

/**
 * In-process, in-memory vector store. This is the store used by the test
 * suite, the eval harness, and any deployment that doesn't have a Postgres
 * connection configured -- i.e. the default "just try it" mode. Similarity
 * search is a brute-force cosine scan, which is more than fast enough for
 * the hundreds-to-low-thousands of chunks a small support KB actually has.
 */
export class MemoryVectorStore implements VectorStore {
  private chunks = new Map<string, EmbeddedChunk>();

  async upsert(chunks: EmbeddedChunk[]): Promise<void> {
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
    }
  }

  async similaritySearch(queryEmbedding: number[], k: number): Promise<RetrievedChunk[]> {
    const scored: RetrievedChunk[] = [];
    for (const chunk of this.chunks.values()) {
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      scored.push({ ...chunk, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    for (const [id, chunk] of this.chunks) {
      if (chunk.documentId === documentId) this.chunks.delete(id);
    }
  }

  async count(): Promise<number> {
    return this.chunks.size;
  }

  async all(): Promise<EmbeddedChunk[]> {
    return [...this.chunks.values()];
  }

  clear(): void {
    this.chunks.clear();
  }
}

let sharedStore: MemoryVectorStore | null = null;

/**
 * Process-wide singleton store used by the API routes in demo/dev mode
 * (no DATABASE_URL configured). Keeping it as a lazily-created singleton
 * means repeated `import`s across route modules share the same data.
 */
export function getSharedMemoryVectorStore(): MemoryVectorStore {
  if (!sharedStore) sharedStore = new MemoryVectorStore();
  return sharedStore;
}
