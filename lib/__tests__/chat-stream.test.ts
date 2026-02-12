import { describe, expect, it } from "vitest";
import {
  CHAT_STREAM_DELIMITER,
  chunkAnswerForStreaming,
  decodeChatStream,
  encodeMetaFooter,
} from "../chat-stream";
import type { ChatStreamMeta } from "../chat-stream";

describe("chunkAnswerForStreaming", () => {
  it("splits into pieces that reconstruct the original string exactly", () => {
    const answer = "The rate limit  resets every 60 seconds [1].";
    const pieces = chunkAnswerForStreaming(answer);
    expect(pieces.join("")).toBe(answer);
    expect(pieces.length).toBeGreaterThan(1);
  });

  it("returns an empty array for an empty string", () => {
    expect(chunkAnswerForStreaming("")).toEqual([]);
  });
});

describe("encodeMetaFooter / decodeChatStream round trip", () => {
  const meta: ChatStreamMeta = {
    status: "answered",
    confidence: 0.42,
    citations: [{ chunkId: "c1", documentId: "d1", documentTitle: "Doc", marker: 1, snippet: "snip" }],
  };

  it("decodes the answer and metadata from a fully-arrived stream", () => {
    const raw = "The answer text [1]." + encodeMetaFooter(meta);
    const decoded = decodeChatStream(raw);
    expect(decoded.answer).toBe("The answer text [1].");
    expect(decoded.meta).toEqual(meta);
  });

  it("returns the partial answer and null meta while only the answer has arrived", () => {
    const decoded = decodeChatStream("The answer so far");
    expect(decoded.answer).toBe("The answer so far");
    expect(decoded.meta).toBeNull();
  });

  it("returns null meta if the delimiter arrived but the JSON payload is still incomplete", () => {
    const partial = "Answer text" + CHAT_STREAM_DELIMITER + '{"status":"answ';
    const decoded = decodeChatStream(partial);
    expect(decoded.answer).toBe("Answer text");
    expect(decoded.meta).toBeNull();
  });

  it("round-trips an abstained response with no citations", () => {
    const abstainMeta: ChatStreamMeta = { status: "abstained", confidence: 0.02, citations: [] };
    const raw = "I don't know." + encodeMetaFooter(abstainMeta);
    const decoded = decodeChatStream(raw);
    expect(decoded.meta).toEqual(abstainMeta);
  });

  it("handles an answer that itself contains no special characters colliding with the delimiter", () => {
    const raw = "Just plain text, nothing tricky." + encodeMetaFooter(meta);
    const decoded = decodeChatStream(raw);
    expect(decoded.answer).toBe("Just plain text, nothing tricky.");
  });
});
