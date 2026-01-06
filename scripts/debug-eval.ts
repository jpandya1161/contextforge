import { chunkDocument } from "../lib/chunking";
import { getDefaultAnswerProvider } from "../lib/answer-providers";
import { getDefaultEmbeddingProvider } from "../lib/embeddings";
import { loadFixtureDocuments } from "../lib/fixtures";
import { answerQuestion } from "../lib/rag-pipeline";
import { MemoryVectorStore } from "../lib/vector-store";

async function main() {
  const ids = process.argv.slice(2);
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

  const dataset = (await import("../eval/dataset.json", { with: { type: "json" } }))
    .default as { id: string; question: string }[];
  for (const id of ids) {
    const item = dataset.find((d) => d.id === id);
    if (!item) {
      console.log("no such id", id);
      continue;
    }
    const result = await answerQuestion(item.question, { store, embeddingProvider, answerProvider });
    console.log("Q:", item.question);
    console.log("status:", result.status, "confidence:", result.confidence.toFixed(3));
    console.log("answer:", result.answer);
    for (const r of result.retrieved) {
      console.log("  -", r.documentId, r.score.toFixed(3));
    }
    console.log("---");
  }
}

main();
