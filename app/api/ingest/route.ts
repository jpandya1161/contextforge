import { NextResponse, type NextRequest } from "next/server";
import { getSharedEmbeddingProvider } from "@/lib/embeddings";
import { ingestDocument } from "@/lib/ingest-pipeline";
import { ingestMarkdown } from "@/lib/ingest/markdown";
import { ingestPdf } from "@/lib/ingest/pdf";
import { ingestUrl } from "@/lib/ingest/url";
import { ensureDemoSeeded } from "@/lib/seed";
import { getDefaultVectorStore } from "@/lib/store-provider";
import type { SourceDocument } from "@/lib/types";

export const runtime = "nodejs";

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) || `doc-${Date.now()}`
  );
}

/**
 * Accepts a document via markdown paste or URL (JSON body) or a PDF upload
 * (multipart/form-data), normalizes it, and runs it through the ingestion
 * pipeline (chunk -> embed -> upsert). This is the "doc ingestion pipeline"
 * the /ingest page's form posts to.
 */
export async function POST(req: NextRequest) {
  await ensureDemoSeeded();

  const contentType = req.headers.get("content-type") ?? "";
  let doc: SourceDocument;

  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as Record<string, unknown>;
      const type = body.type;

      if (type === "markdown") {
        const content = typeof body.content === "string" ? body.content : "";
        if (!content.trim()) {
          return NextResponse.json({ error: "content is required" }, { status: 400 });
        }
        const title = typeof body.title === "string" && body.title.trim() ? body.title : undefined;
        doc = ingestMarkdown(content, {
          id: title ? slugify(title) : undefined,
          title,
          origin: "manual-paste",
        });
      } else if (type === "url") {
        const url = typeof body.url === "string" ? body.url : "";
        if (!url.trim()) {
          return NextResponse.json({ error: "url is required" }, { status: 400 });
        }
        doc = await ingestUrl(url);
      } else {
        return NextResponse.json({ error: 'type must be "markdown" or "url"' }, { status: 400 });
      }
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      doc = await ingestPdf(buffer, { id: slugify(file.name), title: file.name, origin: `upload:${file.name}` });
    } else {
      return NextResponse.json({ error: "unsupported content-type" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to ingest document." },
      { status: 502 },
    );
  }

  const result = await ingestDocument(doc, {
    store: getDefaultVectorStore(),
    embeddingProvider: getSharedEmbeddingProvider(),
  });

  return NextResponse.json(result);
}
