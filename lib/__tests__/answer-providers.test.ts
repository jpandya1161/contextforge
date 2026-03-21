import { describe, expect, it } from "vitest";
import { ExtractiveAnswerProvider } from "../answer-providers";

describe("ExtractiveAnswerProvider", () => {
  const provider = new ExtractiveAnswerProvider();

  it("says it has nothing to answer from when given no context", async () => {
    const answer = await provider.generateAnswer({ question: "Anything?", context: [] });
    expect(answer).toMatch(/don't have any indexed documents/i);
  });

  it("only ever emits text lifted verbatim from the given context (hallucination-proof by construction)", async () => {
    const context = [
      {
        marker: 1,
        documentTitle: "Billing",
        text: "The Team plan costs $12 per member per month. Annual billing gives a 20% discount.",
      },
    ];
    const answer = await provider.generateAnswer({ question: "How much does the Team plan cost?", context });
    // Strip the citation marker and confirm the remaining text is a substring
    // of the source -- nothing was invented.
    const withoutMarker = answer.replace(/\s*\[\d+\]\s*$/, "");
    expect(context[0].text).toContain(withoutMarker);
  });

  it("cites the source marker it drew the sentence from", async () => {
    const context = [{ marker: 3, documentTitle: "Doc", text: "Rate limits reset every sixty seconds." }];
    const answer = await provider.generateAnswer({ question: "How often do rate limits reset?", context });
    expect(answer).toContain("[3]");
  });

  it("cites every source it draws a sentence from when multiple sources are relevant", async () => {
    const context = [
      { marker: 1, documentTitle: "A", text: "API keys can be rotated every 90 days from settings." },
      { marker: 2, documentTitle: "B", text: "API keys support read-only and read-write scopes." },
    ];
    const answer = await provider.generateAnswer({ question: "Tell me about API key rotation and scopes.", context });
    expect(answer).toContain("[1]");
    expect(answer).toContain("[2]");
  });

  it("falls back to the top source's first sentence when nothing lexically overlaps the question", async () => {
    const context = [{ marker: 1, documentTitle: "Doc", text: "Zebra migration patterns vary by season. Second sentence." }];
    const answer = await provider.generateAnswer({ question: "asdkfj qpwoeiru", context });
    expect(answer).toContain("Zebra migration patterns vary by season.");
    expect(answer).toContain("[1]");
  });

  it("is deterministic for identical input", async () => {
    const context = [{ marker: 1, documentTitle: "Doc", text: "Refunds are issued within 14 days for annual plans." }];
    const a = await provider.generateAnswer({ question: "What is the refund window?", context });
    const b = await provider.generateAnswer({ question: "What is the refund window?", context });
    expect(a).toBe(b);
  });
});
