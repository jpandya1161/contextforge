import { describe, expect, it } from "vitest";
import { chunkDocument, chunkText } from "../chunking";

describe("chunkText", () => {
  it("returns an empty array for empty/whitespace input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("keeps a short section as a single chunk", () => {
    const chunks = chunkText("Just one short paragraph about refunds.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("refunds");
  });

  it("groups a heading with the paragraphs that follow it into one chunk", () => {
    const text = [
      "Rotating and revoking keys",
      "We recommend rotating API keys every 90 days. You can revoke a key instantly from Settings.",
    ].join("\n\n");
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("Rotating and revoking keys");
    expect(chunks[0]).toContain("rotating API keys every 90 days");
  });

  it("starts a new chunk at each heading-like paragraph", () => {
    const text = [
      "Refunds",
      "Refunds are issued within 14 days for annual plans.",
      "Payment methods",
      "We accept Visa, Mastercard, and American Express.",
    ].join("\n\n");
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toContain("Refunds");
    expect(chunks[0]).not.toContain("Payment methods");
    expect(chunks[1]).toContain("Payment methods");
    expect(chunks[1]).not.toContain("Refunds are issued");
  });

  it("hard-splits an oversized section with overlap between pieces", () => {
    const sentence = "The rate limit resets every sixty seconds for all workspaces on any plan tier. ";
    const longSection = sentence.repeat(20); // ~1500+ chars, well over default maxChars
    const chunks = chunkText(longSection, { maxChars: 200, overlapChars: 40 });
    expect(chunks.length).toBeGreaterThan(1);
    // Every piece should stay close to the requested size (a little slack for
    // snapping to a sentence/word boundary).
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(240);
    }
    // Reassembling without overlap should still contain the original prose.
    expect(chunks.join(" ")).toContain("rate limit resets");
  });

  it("never produces an empty chunk", () => {
    const chunks = chunkText("A.\n\nB.\n\n\n\nC.");
    for (const chunk of chunks) {
      expect(chunk.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("chunkDocument", () => {
  it("stamps each chunk with a stable id, the source document id/title, and its index", () => {
    const doc = {
      id: "billing-and-plans",
      title: "Billing and Plans",
      origin: "fixtures/docs/billing-and-plans.md",
      content: "Section one.\n\nSection two is a bit longer than the first one.",
    };
    const chunks = chunkDocument(doc);
    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((chunk, i) => {
      expect(chunk.id).toBe(`billing-and-plans::${i}`);
      expect(chunk.documentId).toBe("billing-and-plans");
      expect(chunk.documentTitle).toBe("Billing and Plans");
      expect(chunk.index).toBe(i);
    });
  });

  it("returns no chunks for a document with empty content", () => {
    const doc = { id: "empty", title: "Empty", origin: "test", content: "" };
    expect(chunkDocument(doc)).toEqual([]);
  });
});
