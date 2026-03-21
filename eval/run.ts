/**
 * CLI eval runner: `npm run eval`.
 *
 * Ingests the bundled fixture knowledge base into a fresh in-memory vector
 * store, then runs the golden Q&A dataset through the real RAG pipeline
 * and prints an accuracy / hallucination-rate report.
 *
 * Uses whatever embedding/answer providers are configured via environment
 * variables (OPENAI_API_KEY / ANTHROPIC_API_KEY), falling back to the free
 * local hashing embedder + extractive answerer when unset -- so this
 * always runs, with or without API keys, but produces better answers with
 * them configured. This script is NOT part of `npm test`; it's a separate,
 * optional entry point since it can make paid network calls when keys are
 * present.
 */
import { chunkDocument } from "../lib/chunking";
import { getDefaultAnswerProvider } from "../lib/answer-providers";
import { getDefaultEmbeddingProvider } from "../lib/embeddings";
import { loadFixtureDocuments } from "../lib/fixtures";
import { answerQuestion } from "../lib/rag-pipeline";
import { MemoryVectorStore } from "../lib/vector-store";
import { runEval, type GoldenQAPair } from "./harness";
import dataset from "./dataset.json" with { type: "json" };

async function main() {
  const embeddingProvider = getDefaultEmbeddingProvider();
  const answerProvider = getDefaultAnswerProvider();
  const store = new MemoryVectorStore();

  const docs = loadFixtureDocuments();
  for (const doc of docs) {
    const chunks = chunkDocument(doc);
    const texts = chunks.map((c) => c.text);
    const embeddings = await embeddingProvider.embed(texts);
    await store.upsert(chunks.map((c, i) => ({ ...c, embedding: embeddings[i] })));
  }

  console.log(`Loaded ${docs.length} docs / ${(await store.all()).length} chunks`);
  console.log(`Embedding provider: ${embeddingProvider.name}`);
  console.log(`Answer provider: ${answerProvider.name}\n`);

  const report = await runEval(dataset as GoldenQAPair[], (question) =>
    answerQuestion(question, { store, embeddingProvider, answerProvider }),
  );

  for (const c of report.cases) {
    const mark = c.correct ? "PASS" : "FAIL";
    console.log(`[${mark}] ${c.id} (${c.type}, conf=${c.confidence.toFixed(3)}): ${c.reason}`);
  }

  console.log("\n--- Eval Report ---");
  console.log(`Total cases:        ${report.total}`);
  console.log(`Accuracy:           ${(report.accuracy * 100).toFixed(1)}%`);
  console.log(`Hallucination rate: ${(report.hallucinationRate * 100).toFixed(1)}%`);
  console.log(`Incorrect abstains: ${report.incorrectAbstains}`);
  console.log(`False answers:      ${report.falseAnswers}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
