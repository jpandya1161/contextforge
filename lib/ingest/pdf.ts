import type { SourceDocument } from "../types";

export interface IngestPdfOptions {
  id: string;
  title: string;
  origin?: string;
}

/**
 * Extracts text from a PDF buffer via `pdf-parse` and normalizes it into a
 * `SourceDocument`. `pdf-parse` is dynamically imported so that importing
 * this module doesn't eagerly pull in its (fairly heavy) dependency graph
 * for code paths that never touch PDFs.
 */
export async function ingestPdf(buffer: Buffer, options: IngestPdfOptions): Promise<SourceDocument> {
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  const content = result.text.replace(/\n{3,}/g, "\n\n").trim();
  return {
    id: options.id,
    title: options.title,
    origin: options.origin ?? "pdf-upload",
    content,
  };
}
