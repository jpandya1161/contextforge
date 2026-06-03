import { describe, expect, it } from "vitest";
import { answerQuestion } from "../rag-pipeline";
import type { AnswerProvider, EmbeddingProvider, RetrievedChunk } from "../types";
import type { UnansweredQuestion, UnansweredStore } from "../unanswered-store";
import type { VectorStore } from "../vector-store";

function fakeEmbeddingProvider(): EmbeddingProvider {
  return {
    name: "fake",
    dimensions: 1,
    async embed(texts: string[]) {
      return texts.map(() => [1]);
    },
  };
}

function fakeStore(results: RetrievedChunk[]): VectorStore {
  return {
    async upsert() {},
    async similaritySearch(_q, k) {
      return results.slice(0, k);
    },
    async deleteByDocumentId() {},
    async count() {
      return results.length;
    },
    async all() {
      return results;
    },
  };
}

function scriptedAnswerProvider(answer: string): AnswerProvider {
  return { name: "scripted", async generateAnswer() { return answer; } };
}

function recordingUnansweredStore(): UnansweredStore & { recorded: { question: string; bestScore: number }[] } {
  const recorded: { question: string; bestScore: number }[] = [];
  return {
    recorded,
    async record(question, bestScore) {
      recorded.push({ question, bestScore });
      return { id: "uq_1", question, bestScore, status: "open", resolutionNote: null, createdAt: "now", resolvedAt: null } satisfies UnansweredQuestion;
    },
    async list() { return []; },
    async resolve() { return null; },
    async dismiss() { return null; },
  };
}

function retrievedChunk(id: string, score = 0.6): RetrievedChunk {
  return { id, documentId: "doc-1", documentTitle: "Doc 1", index: 0, text: "some source text", embedding: [1], score };
}

describe("answerQuestion", () => {
  it("returns a grounded answer with citations when confidence clears the threshold and the answer only cites real sources", async () => {
    const result = await answerQuestion("What is the answer?", {
      store: fakeStore([retrievedChunk("a", 0.6)]),
      embeddingProvider: fakeEmbeddingProvider(),
      answerProvider: scriptedAnswerProvider("Here is the answer [1]."),
    });

    expect(result.status).toBe("answered");
    expect(result.answer).toBe("Here is the answer [1].");
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].marker).toBe(1);
  });

  it("abstains and logs the question when confidence is below the threshold", async () => {
    const unansweredStore = recordingUnansweredStore();
    const result = await answerQuestion("An obscure question", {
      store: fakeStore([retrievedChunk("a", 0.01)]),
      embeddingProvider: fakeEmbeddingProvider(),
      answerProvider: scriptedAnswerProvider("Should never be called"),
      unansweredStore,
    });

    expect(result.status).toBe("abstained");
    expect(result.citations).toEqual([]);
    expect(unansweredStore.recorded).toHaveLength(1);
    expect(unansweredStore.recorded[0].question).toBe("An obscure question");
  });

  it("abstains when nothing is retrieved", async () => {
    const result = await answerQuestion("Anything", {
      store: fakeStore([]),
      embeddingProvider: fakeEmbeddingProvider(),
      answerProvider: scriptedAnswerProvider("n/a"),
    });
    expect(result.status).toBe("abstained");
  });

  it("fails safe into an abstain when the answer provider cites a source marker that was never retrieved", async () => {
    const unansweredStore = recordingUnansweredStore();
    const result = await answerQuestion("A question", {
      store: fakeStore([retrievedChunk("a", 0.6)]), // only one source retrieved -> only marker [1] is valid
      embeddingProvider: fakeEmbeddingProvider(),
      answerProvider: scriptedAnswerProvider("A fabricated fact from a source that doesn't exist [7]."),
      unansweredStore,
    });

    expect(result.status).toBe("abstained");
    expect(result.citations).toEqual([]);
    expect(unansweredStore.recorded).toHaveLength(1);
  });

  it("does not call the answer provider at all when confidence is too low", async () => {
    let called = false;
    const answerProvider: AnswerProvider = {
      name: "spy",
      async generateAnswer() {
        called = true;
        return "should not run";
      },
    };
    await answerQuestion("q", {
      store: fakeStore([retrievedChunk("a", 0.0)]),
      embeddingProvider: fakeEmbeddingProvider(),
      answerProvider,
    });
    expect(called).toBe(false);
  });

  it("respects a custom confidence threshold and k passed through to retrieval", async () => {
    const result = await answerQuestion("q", {
      store: fakeStore([retrievedChunk("a", 0.3)]),
      embeddingProvider: fakeEmbeddingProvider(),
      answerProvider: scriptedAnswerProvider("Answer [1]."),
      confidenceThreshold: 0.9,
    });
    expect(result.status).toBe("abstained");
  });
});
