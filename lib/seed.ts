import { isDatabaseConfigured } from "./db/client";
import { getSharedEmbeddingProvider } from "./embeddings";
import { loadFixtureDocuments } from "./fixtures";
import { ingestDocuments } from "./ingest-pipeline";
import { getDefaultVectorStore } from "./store-provider";

let seedPromise: Promise<void> | null = null;

/**
 * Loads the bundled "Nimbus Notes" fixture docs into the active vector
 * store the first time any API route needs them, so `npm run dev` (and the
 * deployed demo) answers questions out of the box with zero setup.
 *
 * A no-op once `DATABASE_URL` is configured: production deployments own
 * their own document set (ingested via /api/ingest or `db:migrate`), and we
 * never want to silently seed demo content into a real database.
 */
export function ensureDemoSeeded(): Promise<void> {
  if (isDatabaseConfigured()) return Promise.resolve();
  if (!seedPromise) {
    seedPromise = seedIfEmpty().catch((err) => {
      // Allow a retry on the next request instead of caching a failure.
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function seedIfEmpty(): Promise<void> {
  const store = getDefaultVectorStore();
  if ((await store.count()) > 0) return;

  const embeddingProvider = getSharedEmbeddingProvider();
  const docs = loadFixtureDocuments();
  await ingestDocuments(docs, { store, embeddingProvider });
}
