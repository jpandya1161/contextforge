import type { RagAnswer } from "../lib/types";

export interface GoldenQAPair {
  id: string;
  type: "answerable" | "unanswerable";
  question: string;
  expectedDocId: string | null;
  expectedKeywords: string[];
}

export interface EvalCaseResult {
  id: string;
  question: string;
  type: GoldenQAPair["type"];
  status: RagAnswer["status"];
  confidence: number;
  answer: string;
  /** Did the pipeline behave correctly for this case? */
  correct: boolean;
  /** Did the answer cite a source outside the expected document? */
  hallucinated: boolean;
  reason: string;
}

export interface EvalReport {
  total: number;
  correct: number;
  accuracy: number;
  hallucinations: number;
  hallucinationRate: number;
  correctAbstains: number;
  incorrectAbstains: number;
  falseAnswers: number;
  cases: EvalCaseResult[];
}

/**
 * Runs the golden Q&A dataset against a caller-supplied `ask` function
 * (normally `answerQuestion` from lib/rag-pipeline.ts, wired to whatever
 * store/providers are in play) and computes accuracy + hallucination-rate
 * metrics.
 *
 * - "Accuracy" for an answerable question means: the bot answered (didn't
 *   abstain), cited the expected source document, and its answer text
 *   contains all expected keywords.
 * - "Accuracy" for an unanswerable question means: the bot abstained.
 * - "Hallucination" means the bot answered (didn't abstain) but the
 *   citations it produced never include the expected source document --
 *   i.e. it grounded its answer in the wrong material, or in nothing.
 */
export async function runEval(
  dataset: GoldenQAPair[],
  ask: (question: string) => Promise<RagAnswer>,
): Promise<EvalReport> {
  const cases: EvalCaseResult[] = [];

  for (const item of dataset) {
    const result = await ask(item.question);
    const lowerAnswer = result.answer.toLowerCase();
    const citedDocIds = new Set(result.citations.map((c) => c.documentId));

    if (item.type === "unanswerable") {
      const correct = result.status === "abstained";
      cases.push({
        id: item.id,
        question: item.question,
        type: item.type,
        status: result.status,
        confidence: result.confidence,
        answer: result.answer,
        correct,
        hallucinated: !correct,
        reason: correct ? "Correctly abstained." : "Should have abstained but produced an answer.",
      });
      continue;
    }

    if (result.status === "abstained") {
      cases.push({
        id: item.id,
        question: item.question,
        type: item.type,
        status: result.status,
        confidence: result.confidence,
        answer: result.answer,
        correct: false,
        hallucinated: false,
        reason: "Incorrectly abstained on an answerable question.",
      });
      continue;
    }

    const citedExpectedDoc = item.expectedDocId ? citedDocIds.has(item.expectedDocId) : true;
    const hasKeywords = item.expectedKeywords.every((kw) => lowerAnswer.includes(kw.toLowerCase()));
    const correct = citedExpectedDoc && hasKeywords;

    cases.push({
      id: item.id,
      question: item.question,
      type: item.type,
      status: result.status,
      confidence: result.confidence,
      answer: result.answer,
      correct,
      hallucinated: !citedExpectedDoc,
      reason: correct
        ? "Answered with expected citation and keywords."
        : !citedExpectedDoc
          ? `Expected citation of "${item.expectedDocId}" but got [${[...citedDocIds].join(", ")}].`
          : `Missing expected keyword(s): ${item.expectedKeywords.filter((kw) => !lowerAnswer.includes(kw.toLowerCase())).join(", ")}`,
    });
  }

  const total = cases.length;
  const correct = cases.filter((c) => c.correct).length;
  const hallucinations = cases.filter((c) => c.hallucinated).length;
  const correctAbstains = cases.filter((c) => c.type === "unanswerable" && c.correct).length;
  const incorrectAbstains = cases.filter((c) => c.type === "answerable" && c.status === "abstained").length;
  const falseAnswers = cases.filter((c) => c.type === "unanswerable" && !c.correct).length;

  return {
    total,
    correct,
    accuracy: total === 0 ? 0 : correct / total,
    hallucinations,
    hallucinationRate: total === 0 ? 0 : hallucinations / total,
    correctAbstains,
    incorrectAbstains,
    falseAnswers,
    cases,
  };
}
