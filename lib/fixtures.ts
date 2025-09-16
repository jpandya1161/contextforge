import fs from "node:fs";
import path from "node:path";
import { ingestMarkdown } from "./ingest/markdown";
import type { SourceDocument } from "./types";

const FIXTURES_DIR = path.join(process.cwd(), "fixtures", "docs");

/**
 * Loads the bundled "Nimbus Notes" sample knowledge base used by the demo
 * app, the eval harness, and integration-style tests. These are the only
 * documents that ship with the repo -- no network fetch, no external
 * dataset download, so this works fully offline and in CI.
 */
export function loadFixtureDocuments(): SourceDocument[] {
  const files = fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  return files.map((file) => {
    const id = file.replace(/\.md$/, "");
    const raw = fs.readFileSync(path.join(FIXTURES_DIR, file), "utf-8");
    return ingestMarkdown(raw, { id, origin: `fixtures/docs/${file}` });
  });
}
