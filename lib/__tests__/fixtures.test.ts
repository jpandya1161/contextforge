import { describe, expect, it } from "vitest";
import { loadFixtureDocuments } from "../fixtures";

describe("loadFixtureDocuments", () => {
  it("loads every markdown file in fixtures/docs as a normalized SourceDocument", () => {
    const docs = loadFixtureDocuments();
    expect(docs.length).toBeGreaterThanOrEqual(9);
    for (const doc of docs) {
      expect(doc.id).toBeTruthy();
      expect(doc.title).toBeTruthy();
      expect(doc.content.length).toBeGreaterThan(0);
      // Markdown syntax should have been stripped by ingestMarkdown.
      expect(doc.content).not.toMatch(/^#{1,6}\s/m);
    }
  });

  it("derives stable document ids from filenames", () => {
    const docs = loadFixtureDocuments();
    expect(docs.map((d) => d.id)).toContain("billing-and-plans");
    expect(docs.map((d) => d.id)).toContain("api-keys-and-auth");
  });

  it("returns documents sorted by filename for deterministic ordering", () => {
    const docs = loadFixtureDocuments();
    const ids = docs.map((d) => d.id);
    expect(ids).toEqual([...ids].sort());
  });
});
