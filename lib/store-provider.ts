import { isDatabaseConfigured } from "./db/client";
import { PgVectorStore } from "./db/pg-vector-store";
import { getSharedMemoryVectorStore } from "./vector-store";
import type { VectorStore } from "./vector-store";

let sharedPgStore: PgVectorStore | null = null;

/**
 * Selects the vector store implementation for the running process: Postgres
 * + pgvector when `DATABASE_URL` is configured (production), otherwise the
 * shared in-memory store (demo/dev/CI). Both implementations satisfy the
 * same `VectorStore` interface, so callers (API routes, seeding, the eval
 * harness) never need to branch on which one is active.
 */
export function getDefaultVectorStore(): VectorStore {
  if (isDatabaseConfigured()) {
    if (!sharedPgStore) sharedPgStore = new PgVectorStore();
    return sharedPgStore;
  }
  return getSharedMemoryVectorStore();
}
