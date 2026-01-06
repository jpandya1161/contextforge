import type { AnswerStatus, Citation } from "./types";

/**
 * Framing for the /api/chat response body: the answer text is streamed
 * word-by-word first (so the chat UI can render a typing effect as it
 * arrives), followed by this delimiter and a trailing JSON blob with the
 * metadata the UI needs to render citations/abstain state -- which can only
 * be known once the full pipeline has run, so it can't be streamed
 * incrementally like the answer text can.
 *
 * Kept in its own module (rather than inline in the route handler) so the
 * encode/decode logic is a plain, deterministic function the client and
 * server share and unit tests can exercise without spinning up a server.
 */
export const CHAT_STREAM_DELIMITER = "\n\n<<<CONTEXTFORGE_META>>>\n\n";

export interface ChatStreamMeta {
  status: AnswerStatus;
  confidence: number;
  citations: Citation[];
}

/**
 * Splits an answer into streamable pieces, each piece being one word plus
 * its trailing whitespace (or a whitespace-only run). Concatenating the
 * pieces reconstructs the original string exactly.
 */
export function chunkAnswerForStreaming(answer: string): string[] {
  if (answer.length === 0) return [];
  const parts = answer.match(/\S+\s*|\s+/g);
  return parts ?? [answer];
}

/** Renders the trailing metadata footer appended after the streamed answer text. */
export function encodeMetaFooter(meta: ChatStreamMeta): string {
  return `${CHAT_STREAM_DELIMITER}${JSON.stringify(meta)}`;
}

export interface DecodedChatStream {
  answer: string;
  meta: ChatStreamMeta | null;
}

/**
 * Parses a (possibly partial) raw stream buffer into the answer text seen
 * so far and, once the footer has fully arrived, the parsed metadata.
 * Safe to call repeatedly on a growing buffer while a stream is still in
 * flight: `meta` is `null` until the delimiter and a complete JSON payload
 * have both been received.
 */
export function decodeChatStream(raw: string): DecodedChatStream {
  const idx = raw.indexOf(CHAT_STREAM_DELIMITER);
  if (idx === -1) return { answer: raw, meta: null };

  const answer = raw.slice(0, idx);
  const metaJson = raw.slice(idx + CHAT_STREAM_DELIMITER.length);
  try {
    const meta = JSON.parse(metaJson) as ChatStreamMeta;
    return { answer, meta };
  } catch {
    // Footer delimiter arrived but the JSON after it isn't complete yet.
    return { answer, meta: null };
  }
}
