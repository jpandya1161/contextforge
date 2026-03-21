import { describe, expect, it } from "vitest";
import { ingestDocument, ingestDocuments } from "../ingest-pipeline";
import { HashingEmbeddingProvider } from "../embeddings";
import { MemoryVectorStore } from "../vector-store";
import type { SourceDocument } from "../types";

function doc(id: string, content: string): SourceDocument {
  return { id, title: `Doc ${id}`, origin: "test", content };
}

describe("ingestDocument", () => {
  it("chunks, embeds, and upserts a document into the store", async () => {
    const store = new MemoryVectorStore();
    const embeddingProvider = new HashingEmbeddingProvider(64);

    const result = await ingestDocument(
      doc("d1", "First paragraph about billing.\n\nSecond paragraph about refunds."),
      { store, embeddingProvider },
    );

    expect(result.documentId).toBe("d1");
    expect(result.chunkCount).toBeGreaterThan(0);
    expect(await store.count()).toBe(result.chunkCount);
  });

  it("returns zero chunks for an empty document without touching the store", async () => {
    const store = new MemoryVectorStore();
    const embeddingProvider = new HashingEmbeddingProvider(64);
    const result = await ingestDocument(doc("empty", ""), { store, embeddingProvider });
    expect(result.chunkCount).toBe(0);
    expect(await store.count()).toBe(0);
  });

  it("re-ingesting the same document id replaces its old chunks rather than duplicating them", async () => {
    const store = new MemoryVectorStore();
    const embeddingProvider = new HashingEmbeddingProvider(64);

    await ingestDocument(doc("d1", "Original short content."), { store, embeddingProvider });
    const firstCount = await store.count();
    expect(firstCount).toBeGreaterThan(0);

    await ingestDocument(doc("d1", "Completely different updated content, now longer than before."), {
      store,
      embeddingProvider,
    });

    const all = await store.all();
    expect(all.every((c) => c.documentId === "d1")).toBe(true);
    // Old chunk text should be gone.
    expect(all.some((c) => c.text.includes("Original short content"))).toBe(false);
  });
});

describe("ingestDocuments", () => {
  it("ingests multiple documents sequentially and returns one result per document", async () => {
    const store = new MemoryVectorStore();
    const embeddingProvider = new HashingEmbeddingProvider(64);
    const results = await ingestDocuments(
      [doc("a", "Content about API keys."), doc("b", "Content about billing plans.")],
      { store, embeddingProvider },
    );
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.documentId)).toEqual(["a", "b"]);
    const all = await store.all();
    expect(new Set(all.map((c) => c.documentId))).toEqual(new Set(["a", "b"]));
  });
});
