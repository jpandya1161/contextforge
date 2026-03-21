import { NextResponse, type NextRequest } from "next/server";
import { getDefaultAnswerProvider } from "@/lib/answer-providers";
import { chunkAnswerForStreaming, encodeMetaFooter } from "@/lib/chat-stream";
import { getSharedEmbeddingProvider } from "@/lib/embeddings";
import { answerQuestion } from "@/lib/rag-pipeline";
import { ensureDemoSeeded } from "@/lib/seed";
import { getDefaultVectorStore } from "@/lib/store-provider";
import { getSharedUnansweredStore } from "@/lib/unanswered-store";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Streams a grounded answer for a single question. Response framing is a
 * plain-text stream: the answer text word-by-word, then a delimiter and a
 * trailing JSON blob (see lib/chat-stream.ts) carrying status/confidence/
 * citations, which can only be known once retrieval + generation have
 * finished.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400, headers: CORS_HEADERS });
  }

  const question = typeof (body as { question?: unknown })?.question === "string"
    ? ((body as { question: string }).question).trim()
    : "";

  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400, headers: CORS_HEADERS });
  }
  if (question.length > 2000) {
    return NextResponse.json({ error: "question is too long" }, { status: 400, headers: CORS_HEADERS });
  }

  await ensureDemoSeeded();

  const result = await answerQuestion(question, {
    store: getDefaultVectorStore(),
    embeddingProvider: getSharedEmbeddingProvider(),
    answerProvider: getDefaultAnswerProvider(),
    unansweredStore: getSharedUnansweredStore(),
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const part of chunkAnswerForStreaming(result.answer)) {
        controller.enqueue(encoder.encode(part));
        // Small delay so the UI visibly streams instead of the whole
        // (already-computed) answer landing in a single chunk.
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
      controller.enqueue(
        encoder.encode(
          encodeMetaFooter({
            status: result.status,
            confidence: result.confidence,
            citations: result.citations,
          }),
        ),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
