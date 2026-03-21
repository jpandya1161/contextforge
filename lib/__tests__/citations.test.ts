import { describe, expect, it } from "vitest";
import { buildCitations, extractUsedMarkers, findHallucinatedMarkers, isGrounded } from "../citations";
import type { RetrievedChunk } from "../types";

function retrievedChunk(id: string, text: string, documentId = "doc-1"): RetrievedChunk {
  return { id, documentId, documentTitle: "Doc", index: 0, text, embedding: [], score: 0.5 };
}

describe("buildCitations", () => {
  it("numbers citations 1-based in retrieval order", () => {
    const citations = buildCitations([retrievedChunk("a", "first"), retrievedChunk("b", "second")]);
    expect(citations.map((c) => c.marker)).toEqual([1, 2]);
    expect(citations[0].chunkId).toBe("a");
    expect(citations[1].chunkId).toBe("b");
  });

  it("truncates long chunk text into a snippet with an ellipsis", () => {
    const longText = "x".repeat(500);
    const [citation] = buildCitations([retrievedChunk("a", longText)]);
    expect(citation.snippet.length).toBe(240);
    expect(citation.snippet.endsWith("...")).toBe(true);
  });

  it("leaves short chunk text untouched", () => {
    const [citation] = buildCitations([retrievedChunk("a", "short text")]);
    expect(citation.snippet).toBe("short text");
  });
});

describe("extractUsedMarkers", () => {
  it("extracts unique, sorted marker numbers referenced in the answer", () => {
    expect(extractUsedMarkers("Refunds work like this [2]. See also [1] and [2].")).toEqual([1, 2]);
  });

  it("returns an empty array when no markers are present", () => {
    expect(extractUsedMarkers("No citations here.")).toEqual([]);
  });
});

describe("findHallucinatedMarkers", () => {
  it("returns markers cited in the answer that have no matching citation", () => {
    const citations = buildCitations([retrievedChunk("a", "text")]);
    expect(findHallucinatedMarkers("Some fact [1] and a fabricated one [4].", citations)).toEqual([4]);
  });

  it("returns an empty array when every cited marker is valid", () => {
    const citations = buildCitations([retrievedChunk("a", "t1"), retrievedChunk("b", "t2")]);
    expect(findHallucinatedMarkers("Fact [1] and another [2].", citations)).toEqual([]);
  });
});

describe("isGrounded", () => {
  it("is false when there are no citations available", () => {
    expect(isGrounded("An answer [1].", [])).toBe(false);
  });

  it("is false when the answer cites nothing", () => {
    const citations = buildCitations([retrievedChunk("a", "t1")]);
    expect(isGrounded("An answer with no markers.", citations)).toBe(false);
  });

  it("is true only when every cited marker maps to a real citation", () => {
    const citations = buildCitations([retrievedChunk("a", "t1")]);
    expect(isGrounded("An answer [1].", citations)).toBe(true);
    expect(isGrounded("An answer [1] and [2].", citations)).toBe(false);
  });
});
