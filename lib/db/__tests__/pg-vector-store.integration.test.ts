import { describe, expect, it } from "vitest";
import { PgVectorStore } from "../pg-vector-store";

/**
 * Integration test against a real Postgres + pgvector instance. Skipped by
 * default -- the default `npm test` run must work with no network and no
 * running database, per the project's offline-verification requirement.
 *
 * To run it locally: start Postgres with the pgvector extension available,
 * set DATABASE_URL, then run `RUN_DB_INTEGRATION=1 npm test`. Never run in
 * CI's default job (no Docker daemon there either).
 */
const shouldRun = process.env.RUN_DB_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!shouldRun)("PgVectorStore (integration, requires live Postgres)", () => {
  it("round-trips an upsert + similarity search against a real database", async () => {
    const store = new PgVectorStore();
    await store.upsert([
      {
        id: "int-test::0",
        documentId: "int-test",
        documentTitle: "Integration Test Doc",
        index: 0,
        text: "Integration test content.",
        embedding: new Array(1536).fill(0.01),
      },
    ]);
    const results = await store.similaritySearch(new Array(1536).fill(0.01), 1);
    expect(results[0]?.documentId).toBe("int-test");
    await store.deleteByDocumentId("int-test");
  });
});
