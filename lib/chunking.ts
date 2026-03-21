import type { Chunk, SourceDocument } from "./types";

export interface ChunkOptions {
  /** Target size of each chunk, in characters. */
  maxChars?: number;
  /** Number of trailing characters repeated at the start of a hard split. */
  overlapChars?: number;
}

const DEFAULTS: Required<ChunkOptions> = {
  maxChars: 500,
  overlapChars: 60,
};

/**
 * A paragraph counts as a section heading once ingestion has stripped
 * markdown syntax: it's a single short line with no terminal punctuation
 * (e.g. "Rotating and revoking keys"), unlike a sentence/paragraph of body
 * text. Used to group paragraphs into semantic sections below.
 */
function looksLikeHeading(paragraph: string): boolean {
  if (paragraph.includes("\n")) return false;
  const trimmed = paragraph.trim();
  if (trimmed.length === 0 || trimmed.length > 70) return false;
  if (/[.!?:]$/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  return words.length <= 8;
}

/** Hard-splits a single (too-long) section into overlapping pieces. */
function splitLongSection(text: string, maxChars: number, overlapChars: number): string[] {
  const pieces: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const slice = text.slice(start, end);
      const lastBoundary = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf("\n"),
      );
      if (lastBoundary > maxChars * 0.4) {
        end = start + lastBoundary + 1;
      }
    }
    const piece = text.slice(start, end).trim();
    if (piece) pieces.push(piece);
    if (end >= text.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }
  return pieces;
}

/**
 * Splits text into chunks along section (heading) boundaries: consecutive
 * paragraphs are grouped under the heading-like paragraph that introduces
 * them, and each section becomes its own chunk. This keeps a fact and the
 * heading that scopes it together (e.g. "Rotating and revoking keys" + "We
 * recommend rotating API keys every 90 days...") instead of either (a)
 * merging unrelated sections into one oversized, unfocused chunk, or (b)
 * splitting mid-section and scattering a heading from its content.
 *
 * A section is only further hard-split (with character overlap) if it
 * still exceeds `maxChars` on its own -- overlap never bleeds across a
 * section boundary, so retrieval doesn't surface garbled half-sentences
 * from an unrelated topic.
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const { maxChars, overlapChars } = { ...DEFAULTS, ...options };
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  const sections: string[] = [];
  let current: string[] = [];
  for (const paragraph of paragraphs) {
    if (looksLikeHeading(paragraph) && current.length > 0) {
      sections.push(current.join("\n\n"));
      current = [paragraph];
    } else {
      current.push(paragraph);
    }
  }
  if (current.length > 0) sections.push(current.join("\n\n"));

  const chunks: string[] = [];
  for (const section of sections) {
    if (section.length <= maxChars) {
      chunks.push(section);
    } else {
      chunks.push(...splitLongSection(section, maxChars, overlapChars));
    }
  }
  return chunks;
}

/** Chunks a source document and returns fully-formed `Chunk` records. */
export function chunkDocument(doc: SourceDocument, options?: ChunkOptions): Chunk[] {
  const pieces = chunkText(doc.content, options);
  return pieces.map((text, index) => ({
    id: `${doc.id}::${index}`,
    documentId: doc.id,
    documentTitle: doc.title,
    index,
    text,
  }));
}
