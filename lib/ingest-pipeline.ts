import { chunkDocument } from "./chunking";
import type { EmbeddingProvider, SourceDocument } from "./types";
import type { VectorStore } from "./vector-store";

export interface IngestDeps {
  store: VectorStore;
  embeddingProvider: EmbeddingProvider;
}

export interface IngestResult {
  documentId: string;
  documentTitle: string;
  chunkCount: number;
}

/**
 * The single choke point for turning an already-normalized `SourceDocument`
 * (output of lib/ingest/{markdown,pdf,url}.ts) into searchable vectors:
 * chunk -> embed -> upsert. Re-ingesting the same document id replaces its
 * old chunks first, so editing a doc and re-uploading it doesn't leave stale
 * chunks behind alongside the new ones.
 */
export async function ingestDocument(doc: SourceDocument, deps: IngestDeps): Promise<IngestResult> {
  const { store, embeddingProvider } = deps;

  await store.deleteByDocumentId(doc.id);

  const chunks = chunkDocument(doc);
  if (chunks.length === 0) {
    return { documentId: doc.id, documentTitle: doc.title, chunkCount: 0 };
  }

  const texts = chunks.map((c) => c.text);
  const embeddings = await embeddingProvider.embed(texts);
  await store.upsert(chunks.map((chunk, i) => ({ ...chunk, embedding: embeddings[i] })));

  return { documentId: doc.id, documentTitle: doc.title, chunkCount: chunks.length };
}

/** Ingests several documents sequentially (embedding providers that fit
 * corpus statistics, like `HashingEmbeddingProvider`, rely on documents
 * being observed one batch at a time rather than interleaved). */
export async function ingestDocuments(docs: SourceDocument[], deps: IngestDeps): Promise<IngestResult[]> {
  const results: IngestResult[] = [];
  for (const doc of docs) {
    results.push(await ingestDocument(doc, deps));
  }
  return results;
}
