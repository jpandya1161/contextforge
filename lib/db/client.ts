import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Lazily-constructed Postgres connection + Drizzle client. `postgres()`
 * itself doesn't open a socket until the first query runs, so importing
 * this module (e.g. transitively, during `next build`) is safe even with no
 * `DATABASE_URL` configured -- production code paths that need a real DB
 * call `getDb()` explicitly and it throws a clear error if unset, rather
 * than silently connecting to nothing.
 */
let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. ContextForge falls back to the in-memory " +
          "vector store for demo/dev use; configure DATABASE_URL (Postgres + " +
          "pgvector) to persist documents across restarts.",
      );
    }
    client = postgres(url, { max: 5 });
    db = drizzle(client, { schema });
  }
  return db;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
