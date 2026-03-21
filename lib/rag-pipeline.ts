import { buildCitations, findHallucinatedMarkers } from "./citations";
import { DEFAULT_CONFIDENCE_THRESHOLD, DEFAULT_TOP_K, retrieve } from "./retrieval";
import type { UnansweredStore } from "./unanswered-store";
import type { AnswerProvider, EmbeddingProvider, RagAnswer } from "./types";
import type { VectorStore } from "./vector-store";

const ABSTAIN_MESSAGE =
  "I don't have enough information in the indexed docs to answer that confidently. " +
  "I've logged your question for the team to review.";

export interface RagPipelineDeps {
  store: VectorStore;
  embeddingProvider: EmbeddingProvider;
  answerProvider: AnswerProvider;
  unansweredStore?: UnansweredStore;
  k?: number;
  confidenceThreshold?: number;
}

/**
 * The full retrieval-augmented answer flow: embed -> retrieve -> confidence
 * gate -> (abstain | generate grounded answer) -> hallucination check.
 *
 * If the answer provider cites a source marker that wasn't actually
 * retrieved, the pipeline strips it back to an abstain rather than serving
 * an ungrounded claim -- this is the "admits when it doesn't know"
 * requirement, enforced in code rather than just prompted for.
 */
export async function answerQuestion(question: string, deps: RagPipelineDeps): Promise<RagAnswer> {
  const { store, embeddingProvider, answerProvider, unansweredStore } = deps;
  const k = deps.k ?? DEFAULT_TOP_K;
  const confidenceThreshold = deps.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  const { retrieved, confidence, shouldAbstain } = await retrieve(question, store, embeddingProvider, {
    k,
    confidenceThreshold,
  });

  if (shouldAbstain) {
    if (unansweredStore) await unansweredStore.record(question, confidence);
    return {
      status: "abstained",
      answer: ABSTAIN_MESSAGE,
      citations: [],
      confidence,
      retrieved,
    };
  }

  const citations = buildCitations(retrieved);
  // The answer provider gets the *full* chunk text, not the truncated
  // display snippet in `citations` -- truncating here would routinely cut
  // off the exact sentence that answers the question.
  const rawAnswer = await answerProvider.generateAnswer({
    question,
    context: retrieved.map((chunk, i) => ({
      marker: i + 1,
      text: chunk.text,
      documentTitle: chunk.documentTitle,
    })),
  });

  const hallucinated = findHallucinatedMarkers(rawAnswer, citations);
  if (hallucinated.length > 0) {
    // The model cited a source number that doesn't exist in what we gave
    // it. Rather than ship an ungrounded answer, fail safe into an abstain.
    if (unansweredStore) await unansweredStore.record(question, confidence);
    return {
      status: "abstained",
      answer: ABSTAIN_MESSAGE,
      citations: [],
      confidence,
      retrieved,
    };
  }

  return {
    status: "answered",
    answer: rawAnswer,
    citations,
    confidence,
    retrieved,
  };
}
