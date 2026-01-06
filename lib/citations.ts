import type { Citation, RetrievedChunk } from "./types";

/** Builds the numbered citation list handed to the answer provider and UI. */
export function buildCitations(retrieved: RetrievedChunk[]): Citation[] {
  return retrieved.map((chunk, i) => ({
    chunkId: chunk.id,
    documentId: chunk.documentId,
    documentTitle: chunk.documentTitle,
    marker: i + 1,
    snippet: chunk.text.length > 240 ? `${chunk.text.slice(0, 237)}...` : chunk.text,
  }));
}

const MARKER_PATTERN = /\[(\d+)\]/g;

/** Extracts the set of `[n]` citation markers actually used in an answer. */
export function extractUsedMarkers(answer: string): number[] {
  const found = new Set<number>();
  for (const match of answer.matchAll(MARKER_PATTERN)) {
    found.add(Number(match[1]));
  }
  return [...found].sort((a, b) => a - b);
}

/**
 * Detects hallucinated citations: markers referenced in the answer that
 * don't correspond to any chunk actually retrieved for this query. A
 * grounded answer only ever cites markers 1..citations.length.
 */
export function findHallucinatedMarkers(answer: string, citations: Citation[]): number[] {
  const valid = new Set(citations.map((c) => c.marker));
  return extractUsedMarkers(answer).filter((m) => !valid.has(m));
}

/** True if the answer cites at least one of the retrieved sources. */
export function isGrounded(answer: string, citations: Citation[]): boolean {
  if (citations.length === 0) return false;
  const used = extractUsedMarkers(answer);
  return used.length > 0 && used.every((m) => citations.some((c) => c.marker === m));
}
