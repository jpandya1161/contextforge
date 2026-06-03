import { stem } from "./stemming";
import { STOPWORDS } from "./stopwords";
import type { AnswerProvider } from "./types";

function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Extractive, fully offline answer provider: no LLM call at all. It scores
 * every sentence across the retrieved context by lexical overlap with the
 * question, stitches together the best 1-3 sentences per distinct source,
 * and cites every source it drew from.
 *
 * Because it only ever emits text lifted verbatim from the retrieved
 * chunks, it is hallucination-proof by construction -- a useful property
 * for a "cheap, self-hostable" default, and what makes the eval harness and
 * unit tests fully deterministic without network access. This is the
 * provider used when no `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` is configured.
 */
export class ExtractiveAnswerProvider implements AnswerProvider {
  readonly name = "extractive-local";

  async generateAnswer(input: {
    question: string;
    context: { marker: number; text: string; documentTitle: string }[];
  }): Promise<string> {
    const { question, context } = input;
    if (context.length === 0) {
      return "I don't have any indexed documents to answer from yet.";
    }

    // Downweight words that show up in most/all of the retrieved sources
    // (product name, generic nouns like "plan" or "settings") so sentence
    // selection is driven by the vocabulary that actually distinguishes
    // this source from the others, not boilerplate they all share.
    const docFreq = new Map<string, number>();
    for (const source of context) {
      for (const w of new Set(tokenizeWords(source.text))) {
        docFreq.set(w, (docFreq.get(w) ?? 0) + 1);
      }
    }
    const idf = (word: string) => Math.log((context.length + 1) / ((docFreq.get(word) ?? 0) + 1)) + 1;

    const qWords = new Set(tokenizeWords(question));
    const parts: string[] = [];

    for (const source of context) {
      const sentences = splitSentences(source.text);
      let best = "";
      let bestScore = -1;
      for (const sentence of sentences) {
        const words = tokenizeWords(sentence);
        if (words.length === 0) continue;
        const overlapWeight = words
          .filter((w) => qWords.has(w))
          .reduce((sum, w) => sum + idf(w), 0);
        const score = overlapWeight / Math.sqrt(words.length);
        if (score > bestScore) {
          bestScore = score;
          best = sentence;
        }
      }
      if (best && bestScore > 0) {
        parts.push(`${best} [${source.marker}]`);
      }
    }

    if (parts.length === 0) {
      // Nothing in the retrieved context lexically overlaps the question;
      // fall back to the single top chunk's opening sentence so the answer
      // is still grounded, just less targeted.
      const top = context[0];
      const first = splitSentences(top.text)[0] ?? top.text;
      return `${first} [${top.marker}]`;
    }

    return parts.join(" ");
  }
}

/**
 * Wraps an LLM (Claude via the Vercel AI SDK) for higher-quality answers in
 * production. Requires `ANTHROPIC_API_KEY`; never exercised by unit tests
 * since that would need network access to a paid API.
 */
export class AnthropicAnswerProvider implements AnswerProvider {
  readonly name = "anthropic:claude-3-5-haiku";

  constructor(private readonly apiKey: string, private readonly model = "claude-3-5-haiku-20241022") {
    if (!apiKey) throw new Error("AnthropicAnswerProvider requires an API key");
  }

  async generateAnswer(input: {
    question: string;
    context: { marker: number; text: string; documentTitle: string }[];
  }): Promise<string> {
    const { generateText } = await import("ai");
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    const anthropic = createAnthropic({ apiKey: this.apiKey });

    const contextBlock = input.context
      .map((c) => `[${c.marker}] (${c.documentTitle})\n${c.text}`)
      .join("\n\n---\n\n");

    const { text } = await generateText({
      model: anthropic(this.model),
      system:
        "You are a support answer bot. Answer ONLY using the numbered source " +
        "excerpts provided. Cite every claim with its bracketed source number, " +
        "e.g. [1]. If the sources don't contain the answer, say you don't know " +
        "instead of guessing. Never invent a source number that wasn't given to you.",
      prompt: `Sources:\n${contextBlock}\n\nQuestion: ${input.question}`,
    });
    return text;
  }
}

export function getDefaultAnswerProvider(): AnswerProvider {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) return new AnthropicAnswerProvider(anthropicKey);
  return new ExtractiveAnswerProvider();
}
