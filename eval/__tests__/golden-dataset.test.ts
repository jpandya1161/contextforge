import { describe, expect, it } from "vitest";
import { chunkDocument } from "../../lib/chunking";
import { ExtractiveAnswerProvider } from "../../lib/answer-providers";
import { HashingEmbeddingProvider } from "../../lib/embeddings";
import { loadFixtureDocuments } from "../../lib/fixtures";
import { answerQuestion } from "../../lib/rag-pipeline";
import { MemoryVectorStore } from "../../lib/vector-store";
import { runEval, type GoldenQAPair } from "../harness";
import dataset from "../dataset.json" with { type: "json" };

/**
 * Runs the golden Q&A dataset through the *real* offline pipeline (the free
 * hashing embedder + extractive/hallucination-proof answer provider, over
 * the bundled fixture docs, entirely in-memory) and asserts the quality bar
 * this project claims: mostly-correct grounded answers, zero hallucinated
 * citations, and correct abstains on out-of-scope questions. This is the
 * test that actually exercises "does the retrieval + abstain threshold
 * work", not just each unit in isolation.
 */
describe("golden dataset eval (real offline pipeline)", () => {
  it("meets the accuracy and hallucination bar with zero network/LLM calls", async () => {
    const embeddingProvider = new HashingEmbeddingProvider();
    const answerProvider = new ExtractiveAnswerProvider();
    const store = new MemoryVectorStore();

    const docs = loadFixtureDocuments();
    expect(docs.length).toBeGreaterThanOrEqual(9);

    for (const doc of docs) {
      const chunks = chunkDocument(doc);
      const texts = chunks.map((c) => c.text);
      const embeddings = await embeddingProvider.embed(texts);
      await store.upsert(chunks.map((c, i) => ({ ...c, embedding: embeddings[i] })));
    }

    const report = await runEval(dataset as GoldenQAPair[], (question) =>
      answerQuestion(question, { store, embeddingProvider, answerProvider }),
    );

    // Never ship an answer whose citation doesn't match the source it was
    // actually drawn from -- this is the non-negotiable one.
    expect(report.hallucinationRate).toBe(0);

    // The free local pipeline (no LLM) should get most answerable questions
    // right; leave headroom for lexical-overlap misses without letting a
    // real regression slide through.
    expect(report.accuracy).toBeGreaterThanOrEqual(0.8);

    // Every unanswerable/out-of-scope question must be abstained on, not
    // answered with a plausible-sounding guess.
    const falseAnswerCases = report.cases.filter((c) => c.type === "unanswerable" && !c.correct);
    expect(falseAnswerCases).toEqual([]);
  });
});
