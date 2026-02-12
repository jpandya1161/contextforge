import { beforeEach, describe, expect, it } from "vitest";
import { MemoryVectorStore, getSharedMemoryVectorStore } from "../vector-store";
import type { EmbeddedChunk } from "../types";

function chunk(id: string, embedding: number[], overrides: Partial<EmbeddedChunk> = {}): EmbeddedChunk {
  return {
    id,
    documentId: overrides.documentId ?? "doc-1",
    documentTitle: overrides.documentTitle ?? "Doc 1",
    index: overrides.index ?? 0,
    text: overrides.text ?? `text for ${id}`,
    embedding,
  };
}

describe("MemoryVectorStore", () => {
  let store: MemoryVectorStore;

  beforeEach(() => {
    store = new MemoryVectorStore();
  });

  it("returns the k nearest chunks sorted by descending cosine similarity", async () => {
    await store.upsert([
      chunk("a", [1, 0]),
      chunk("b", [0.9, 0.1]),
      chunk("c", [0, 1]),
    ]);

    const results = await store.similaritySearch([1, 0], 2);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("a");
    expect(results[1].id).toBe("b");
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("upsert replaces a chunk with the same id instead of duplicating it", async () => {
    await store.upsert([chunk("a", [1, 0], { text: "old" })]);
    await store.upsert([chunk("a", [1, 0], { text: "new" })]);
    expect(await store.count()).toBe(1);
    const [only] = await store.all();
    expect(only.text).toBe("new");
  });

  it("deleteByDocumentId removes only chunks belonging to that document", async () => {
    await store.upsert([
      chunk("a1", [1, 0], { documentId: "doc-a" }),
      chunk("a2", [1, 0], { documentId: "doc-a" }),
      chunk("b1", [0, 1], { documentId: "doc-b" }),
    ]);
    await store.deleteByDocumentId("doc-a");
    const remaining = await store.all();
    expect(remaining.map((c) => c.id).sort()).toEqual(["b1"]);
  });

  it("returns an empty array from an empty store", async () => {
    expect(await store.similaritySearch([1, 0], 5)).toEqual([]);
    expect(await store.count()).toBe(0);
  });

  it("clear() empties the store", async () => {
    await store.upsert([chunk("a", [1, 0])]);
    store.clear();
    expect(await store.count()).toBe(0);
  });
});

describe("getSharedMemoryVectorStore", () => {
  it("returns the same instance across calls", () => {
    expect(getSharedMemoryVectorStore()).toBe(getSharedMemoryVectorStore());
  });
});
