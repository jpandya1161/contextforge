"use client";

import { useRef, useState } from "react";
import { decodeChatStream, type ChatStreamMeta } from "@/lib/chat-stream";
import type { Citation } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  meta?: ChatStreamMeta;
  streaming?: boolean;
}

let msgCounter = 0;
function nextMsgId(): string {
  msgCounter += 1;
  return `m${msgCounter}`;
}

/**
 * The core chat experience: a message list plus an input box that streams
 * the answer from /api/chat and renders citation badges with the retrieved
 * source snippet on hover once the metadata footer arrives. Used directly
 * on the landing page demo, and this is the logic the embeddable widget
 * (widget/embed.ts) reimplements in vanilla JS for pages that can't ship
 * React.
 */
export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || busy) return;

    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { id: nextMsgId(), role: "user", text: trimmed }]);

    const assistantId = nextMsgId();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", text: "", streaming: true }]);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        const { answer, meta } = decodeChatStream(raw);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, text: answer, meta: meta ?? m.meta } : m)),
        );
      }

      const final = decodeChatStream(raw);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, text: final.answer, meta: final.meta ?? m.meta, streaming: false } : m,
        ),
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex h-[32rem] flex-col overflow-hidden rounded-lg border border-forge-border bg-forge-panel">
      <div className="flex-1 space-y-4 overflow-y-auto scrollbar-thin p-4">
        {messages.length === 0 && (
          <p className="text-sm text-forge-dim">
            Ask something a Nimbus Notes user might ask support &mdash; e.g. &ldquo;How many API keys can a
            workspace have?&rdquo;
          </p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      {error && <p className="border-t border-forge-border px-4 py-2 text-xs text-red-400">{error}</p>}

      <form
        className="flex gap-2 border-t border-forge-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          className="flex-1 rounded-md border border-forge-border bg-forge-bg px-3 py-2 text-sm text-forge-text placeholder:text-forge-dim focus:border-forge-amber/60 focus:outline-none"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || input.trim().length === 0}>
          {busy ? "Thinking…" : "Ask"}
        </Button>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-lg bg-forge-amber/10 px-3 py-2 text-sm text-forge-text"
            : "max-w-[85%] rounded-lg bg-forge-bg px-3 py-2 text-sm text-forge-text"
        }
      >
        {message.meta?.status === "abstained" && (
          <span className="mb-1 inline-block rounded bg-forge-amberDim/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-forge-amber">
            Abstained
          </span>
        )}
        <AnswerWithCitations text={message.text} citations={message.meta?.citations ?? []} />
        {message.streaming && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-forge-dim" />}
      </div>
    </div>
  );
}

/** Renders answer text with `[n]` markers turned into hoverable citation badges (source highlighting). */
function AnswerWithCitations({ text, citations }: { text: string; citations: Citation[] }) {
  if (citations.length === 0) return <span className="whitespace-pre-wrap">{text}</span>;

  const byMarker = new Map(citations.map((c) => [c.marker, c]));
  const parts = text.split(/(\[\d+\])/g);

  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (!match) return <span key={i}>{part}</span>;
        const citation = byMarker.get(Number(match[1]));
        if (!citation) return <span key={i}>{part}</span>;
        return (
          <span
            key={i}
            title={`${citation.documentTitle}: ${citation.snippet}`}
            className="mx-0.5 inline-flex cursor-help items-center rounded bg-forge-amber/20 px-1 text-[11px] font-semibold text-forge-amber align-super"
          >
            {match[1]}
          </span>
        );
      })}
    </span>
  );
}
