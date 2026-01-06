/**
 * Shared domain types for the ContextForge RAG pipeline.
 */

export interface SourceDocument {
  /** Stable id, e.g. slug of the file/URL it came from. */
  id: string;
  title: string;
  /** Where the content came from: a file path, "markdown", or a URL. */
  origin: string;
  /** Raw text content after ingestion (post PDF/HTML extraction). */
  content: string;
}

export interface Chunk {
  id: string;
  documentId: string;
  documentTitle: string;
  /** 0-based position of this chunk within its source document. */
  index: number;
  text: string;
}

export interface EmbeddedChunk extends Chunk {
  embedding: number[];
}

export interface RetrievedChunk extends EmbeddedChunk {
  /** Cosine similarity in [-1, 1] between the query and this chunk. */
  score: number;
}

export interface Citation {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  /** 1-based marker used in the answer text, e.g. "[1]". */
  marker: number;
  snippet: string;
}

export type AnswerStatus = "answered" | "abstained";

export interface RagAnswer {
  status: AnswerStatus;
  answer: string;
  citations: Citation[];
  confidence: number;
  retrieved: RetrievedChunk[];
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export interface AnswerProvider {
  readonly name: string;
  generateAnswer(input: {
    question: string;
    context: { marker: number; text: string; documentTitle: string }[];
  }): Promise<string>;
}
