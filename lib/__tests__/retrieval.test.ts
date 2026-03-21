import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIDENCE_THRESHOLD, DEFAULT_TOP_K, retrieve } from "../retrieval";
import type { EmbeddingProvider, RetrievedChunk } from "../types";
import type { VectorStore } from "../vector-store";

function fakeEmbeddingProvider(): EmbeddingProvider {
  return {
    name: "fake",
    dimensions: 1,
    async embed(texts: string[]) {
      return texts.map(() => [1]);
    },
  };
}

function fakeStore(results: RetrievedChunk[]): VectorStore {
  return {
    async upsert() {},
    async similaritySearch(_query, k) {
      return results.slice(0, k);
    },
    async deleteByDocumentId() {},
    async count() {
      return results.length;
    },
    async all() {
      return results;
    },
  };
}

function retrievedChunk(id: string, score: number): RetrievedChunk {
  return { id, documentId: "doc", documentTitle: "Doc", index: 0, text: "text", embedding: [1], score };
}

describe("retrieve", () => {
  it("does not abstain when the top result clears the confidence threshold", async () => {
    const store = fakeStore([retrievedChunk("a", 0.8), retrievedChunk("b", 0.5)]);
    const result = await retrieve("question", store, fakeEmbeddingProvider());
    expect(result.shouldAbstain).toBe(false);
    expect(result.confidence).toBe(0.8);
    expect(result.retrieved).toHaveLength(2);
  });

  it("abstains when the top result is below the confidence threshold", async () => {
    const store = fakeStore([retrievedChunk("a", 0.05)]);
    const result = await retrieve("question", store, fakeEmbeddingProvider());
    expect(result.shouldAbstain).toBe(true);
    expect(result.confidence).toBe(0.05);
  });

  it("abstains when nothing is retrieved at all", async () => {
    const store = fakeStore([]);
    const result = await retrieve("question", store, fakeEmbeddingProvider());
    expect(result.shouldAbstain).toBe(true);
    expect(result.confidence).toBe(0);
    expect(result.retrieved).toEqual([]);
  });

  it("treats a score exactly at the threshold as usable (not abstained)", async () => {
    const store = fakeStore([retrievedChunk("a", DEFAULT_CONFIDENCE_THRESHOLD)]);
    const result = await retrieve("question", store, fakeEmbeddingProvider());
    expect(result.shouldAbstain).toBe(false);
  });

  it("honors a custom confidence threshold override", async () => {
    const store = fakeStore([retrievedChunk("a", 0.5)]);
    const strict = await retrieve("q", store, fakeEmbeddingProvider(), { confidenceThreshold: 0.9 });
    expect(strict.shouldAbstain).toBe(true);
    const lenient = await retrieve("q", store, fakeEmbeddingProvider(), { confidenceThreshold: 0.1 });
    expect(lenient.shouldAbstain).toBe(false);
  });

  it("respects a custom k, defaulting to DEFAULT_TOP_K", async () => {
    const results = Array.from({ length: 10 }, (_, i) => retrievedChunk(`c${i}`, 0.9 - i * 0.01));
    const store = fakeStore(results);
    const defaultResult = await retrieve("q", store, fakeEmbeddingProvider());
    expect(defaultResult.retrieved).toHaveLength(DEFAULT_TOP_K);
    const customResult = await retrieve("q", store, fakeEmbeddingProvider(), { k: 3 });
    expect(customResult.retrieved).toHaveLength(3);
  });
});
