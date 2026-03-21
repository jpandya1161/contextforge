import { describe, expect, it } from "vitest";
import { HashingEmbeddingProvider } from "../embeddings";
import { cosineSimilarity } from "../similarity";

describe("HashingEmbeddingProvider", () => {
  it("produces a unit-length vector of the configured dimensionality", async () => {
    const provider = new HashingEmbeddingProvider(128);
    const [vector] = await provider.embed(["Rate limits reset every sixty seconds."]);
    expect(vector).toHaveLength(128);
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("is deterministic for the same input text", async () => {
    const provider = new HashingEmbeddingProvider(256);
    const [a] = await provider.embed(["How do I rotate my API key?"]);
    const [b] = await provider.embed(["How do I rotate my API key?"]);
    expect(a).toEqual(b);
  });

  it("returns a zero vector for text with no scorable tokens", async () => {
    const provider = new HashingEmbeddingProvider(64);
    const [vector] = await provider.embed(["the a an"]); // pure stopwords
    expect(vector.every((v) => v === 0)).toBe(true);
  });

  it("embeds semantically-overlapping text more similarly than unrelated text", async () => {
    const provider = new HashingEmbeddingProvider(512);
    // Fit corpus statistics first, same as ingestion would.
    await provider.embed([
      "API keys can be rotated from the developer settings page every 90 days.",
      "Refunds are issued for annual plans cancelled within 14 days of purchase.",
    ]);

    const [query] = await provider.embed(["How often should I rotate my API key?"]);
    const [apiDoc] = await provider.embed(["API keys can be rotated from the developer settings page."]);
    const [refundDoc] = await provider.embed(["Refunds are issued for annual plans within 14 days."]);

    const simToApiDoc = cosineSimilarity(query, apiDoc);
    const simToRefundDoc = cosineSimilarity(query, refundDoc);
    expect(simToApiDoc).toBeGreaterThan(simToRefundDoc);
  });

  it("weights distinctive/rare tokens more than tokens common across the fitted corpus (IDF)", async () => {
    const provider = new HashingEmbeddingProvider(2048);
    // "Nimbus" and "notes" show up in every doc (like a boilerplate product
    // name); "webhook" only shows up in one. IDF should downweight the former.
    await provider.embed([
      "Nimbus Notes billing settings and Nimbus Notes plans overview.",
      "Nimbus Notes webhook signature verification header details.",
      "Nimbus Notes export and Nimbus Notes backup schedule.",
    ]);

    const [query] = await provider.embed(["webhook signature header"]);
    const [webhookDoc] = await provider.embed(["Nimbus Notes webhook signature verification header details."]);
    const [billingDoc] = await provider.embed(["Nimbus Notes billing settings and Nimbus Notes plans overview."]);

    expect(cosineSimilarity(query, webhookDoc)).toBeGreaterThan(cosineSimilarity(query, billingDoc));
  });

  it("reset() clears fitted IDF statistics", async () => {
    const provider = new HashingEmbeddingProvider(64);
    await provider.embed(["alpha beta gamma", "delta epsilon zeta"]);
    provider.reset();
    // After reset, totalDocs is back to 0 so idf() takes the "no corpus fitted" branch (returns 1 uniformly).
    const [a] = await provider.embed(["alpha beta gamma"]);
    const fresh = new HashingEmbeddingProvider(64);
    const [b] = await fresh.embed(["alpha beta gamma"]);
    expect(a).toEqual(b);
  });
});
