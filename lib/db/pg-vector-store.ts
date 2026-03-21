import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { chunks, documents } from "./schema";
import type { VectorStore } from "../vector-store";
import type { EmbeddedChunk, RetrievedChunk } from "../types";

/**
 * Production vector store backed by Postgres + pgvector. Uses the `<=>`
 * cosine-distance operator so similarity search happens in the database
 * with an index, rather than pulling every row into the app process (that's
 * what MemoryVectorStore is for, in dev/test).
 *
 * Not exercised by the unit test suite: doing so would require a live
 * Postgres instance with the vector extension, which the "offline,
 * no-Docker" verification constraint rules out. It's still real,
 * idiomatic Drizzle code, wired up the same way the in-memory store is, and
 * is intended to be covered by the optional Postgres integration test in
 * `lib/db/__tests__/pg-vector-store.integration.test.ts` (skipped by
 * default; see README).
 */
export class PgVectorStore implements VectorStore {
  async upsert(chunksToInsert: EmbeddedChunk[]): Promise<void> {
    if (chunksToInsert.length === 0) return;
    const db = getDb();
    const docIds = [...new Set(chunksToInsert.map((c) => c.documentId))];
    for (const docId of docIds) {
      const first = chunksToInsert.find((c) => c.documentId === docId)!;
      await db
        .insert(documents)
        .values({ id: docId, title: first.documentTitle, origin: "unknown", content: "" })
        .onConflictDoNothing({ target: documents.id });
    }

    for (const chunk of chunksToInsert) {
      await db
        .insert(chunks)
        .values({
          id: chunk.id,
          documentId: chunk.documentId,
          documentTitle: chunk.documentTitle,
          index: chunk.index,
          text: chunk.text,
          embedding: chunk.embedding,
        })
        .onConflictDoUpdate({
          target: chunks.id,
          set: {
            text: chunk.text,
            embedding: chunk.embedding,
            documentTitle: chunk.documentTitle,
            index: chunk.index,
          },
        });
    }
  }

  async similaritySearch(queryEmbedding: number[], k: number): Promise<RetrievedChunk[]> {
    const db = getDb();
    const literal = `[${queryEmbedding.join(",")}]`;
    const distance = sql<number>`${chunks.embedding} <=> ${literal}::vector`;
    const rows = await db
      .select({
        id: chunks.id,
        documentId: chunks.documentId,
        documentTitle: chunks.documentTitle,
        index: chunks.index,
        text: chunks.text,
        embedding: chunks.embedding,
        distance,
      })
      .from(chunks)
      .orderBy(sql`${distance} asc`)
      .limit(k);

    return rows.map((row) => ({
      id: row.id,
      documentId: row.documentId,
      documentTitle: row.documentTitle,
      index: row.index,
      text: row.text,
      embedding: row.embedding,
      // pgvector's <=> is cosine *distance* (1 - cosine similarity).
      score: 1 - Number(row.distance),
    }));
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    const db = getDb();
    await db.delete(documents).where(eq(documents.id, documentId));
  }

  async count(): Promise<number> {
    const db = getDb();
    const [row] = await db.select({ count: sql<number>`count(*)` }).from(chunks);
    return Number(row?.count ?? 0);
  }

  async all(): Promise<EmbeddedChunk[]> {
    const db = getDb();
    const rows = await db
      .select({
        id: chunks.id,
        documentId: chunks.documentId,
        documentTitle: chunks.documentTitle,
        index: chunks.index,
        text: chunks.text,
        embedding: chunks.embedding,
      })
      .from(chunks)
      .orderBy(desc(chunks.createdAt));
    return rows;
  }
}
