import { describe, expect, it } from "vitest";
import { runEval, type GoldenQAPair } from "../harness";
import type { RagAnswer } from "../../lib/types";

function answered(text: string, docId: string, confidence = 0.5): RagAnswer {
  return {
    status: "answered",
    answer: text,
    confidence,
    retrieved: [],
    citations: [{ chunkId: `${docId}::0`, documentId: docId, documentTitle: docId, marker: 1, snippet: text }],
  };
}

function abstained(confidence = 0.05): RagAnswer {
  return { status: "abstained", answer: "I don't know.", confidence, retrieved: [], citations: [] };
}

describe("runEval", () => {
  it("marks an answerable case correct when it answers, cites the expected doc, and includes expected keywords", async () => {
    const dataset: GoldenQAPair[] = [
      { id: "q1", type: "answerable", question: "Cost?", expectedDocId: "billing", expectedKeywords: ["$12"] },
    ];
    const report = await runEval(dataset, async () => answered("It costs $12 per month [1].", "billing"));
    expect(report.accuracy).toBe(1);
    expect(report.cases[0].correct).toBe(true);
    expect(report.hallucinations).toBe(0);
  });

  it("marks an answerable case incorrect and hallucinated when it cites the wrong document", async () => {
    const dataset: GoldenQAPair[] = [
      { id: "q1", type: "answerable", question: "Cost?", expectedDocId: "billing", expectedKeywords: ["$12"] },
    ];
    const report = await runEval(dataset, async () => answered("It costs $12 per month [1].", "wrong-doc"));
    expect(report.cases[0].correct).toBe(false);
    expect(report.cases[0].hallucinated).toBe(true);
    expect(report.hallucinations).toBe(1);
  });

  it("marks an answerable case incorrect when the expected keyword is missing", async () => {
    const dataset: GoldenQAPair[] = [
      { id: "q1", type: "answerable", question: "Cost?", expectedDocId: "billing", expectedKeywords: ["$99"] },
    ];
    const report = await runEval(dataset, async () => answered("It costs $12 per month [1].", "billing"));
    expect(report.cases[0].correct).toBe(false);
    expect(report.cases[0].hallucinated).toBe(false);
    expect(report.cases[0].reason).toMatch(/missing expected keyword/i);
  });

  it("marks an answerable case incorrect when the bot abstains instead of answering", async () => {
    const dataset: GoldenQAPair[] = [
      { id: "q1", type: "answerable", question: "Cost?", expectedDocId: "billing", expectedKeywords: [] },
    ];
    const report = await runEval(dataset, async () => abstained());
    expect(report.cases[0].correct).toBe(false);
    expect(report.incorrectAbstains).toBe(1);
    expect(report.hallucinations).toBe(0);
  });

  it("marks an unanswerable case correct when the bot abstains", async () => {
    const dataset: GoldenQAPair[] = [
      { id: "u1", type: "unanswerable", question: "Weird question", expectedDocId: null, expectedKeywords: [] },
    ];
    const report = await runEval(dataset, async () => abstained());
    expect(report.cases[0].correct).toBe(true);
    expect(report.correctAbstains).toBe(1);
    expect(report.falseAnswers).toBe(0);
  });

  it("marks an unanswerable case incorrect (a false answer) when the bot answers anyway", async () => {
    const dataset: GoldenQAPair[] = [
      { id: "u1", type: "unanswerable", question: "Weird question", expectedDocId: null, expectedKeywords: [] },
    ];
    const report = await runEval(dataset, async () => answered("Here's a made-up answer [1].", "any-doc"));
    expect(report.cases[0].correct).toBe(false);
    expect(report.falseAnswers).toBe(1);
  });

  it("computes aggregate accuracy and hallucination rate across a mixed dataset", async () => {
    const dataset: GoldenQAPair[] = [
      { id: "q1", type: "answerable", question: "A", expectedDocId: "d1", expectedKeywords: [] },
      { id: "q2", type: "answerable", question: "B", expectedDocId: "d2", expectedKeywords: [] },
      { id: "u1", type: "unanswerable", question: "C", expectedDocId: null, expectedKeywords: [] },
    ];
    const report = await runEval(dataset, async (question) => {
      if (question === "A") return answered("Answer A [1].", "d1");
      if (question === "B") return answered("Answer B [1].", "wrong"); // hallucinated
      return abstained(); // correctly abstained
    });
    expect(report.total).toBe(3);
    expect(report.correct).toBe(2);
    expect(report.accuracy).toBeCloseTo(2 / 3, 10);
    expect(report.hallucinationRate).toBeCloseTo(1 / 3, 10);
  });

  it("returns a zeroed report for an empty dataset", async () => {
    const report = await runEval([], async () => abstained());
    expect(report.total).toBe(0);
    expect(report.accuracy).toBe(0);
    expect(report.hallucinationRate).toBe(0);
  });
});
