import type { SourceDocument } from "../types";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

/** Strips the leading `# Title` heading (if present) and returns it. */
function extractTitle(markdown: string, fallback: string): { title: string; body: string } {
  const match = markdown.match(/^\s*#\s+(.+)\s*\n?/);
  if (match) {
    return { title: match[1].trim(), body: markdown.slice(match[0].length) };
  }
  return { title: fallback, body: markdown };
}

/** Very small markdown-to-plaintext normalizer: strips formatting markup but
 * keeps paragraph structure, so chunking still works on the resulting text
 * (headings become their own short paragraphs, which is fine for chunking).
 */
function stripMarkdownSyntax(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?/g, "").trim())
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "- ")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1 ($2)")
    .trim();
}

export interface IngestMarkdownOptions {
  id?: string;
  title?: string;
  origin?: string;
}

/** Ingests a raw markdown string into a normalized `SourceDocument`. */
export function ingestMarkdown(markdown: string, options: IngestMarkdownOptions = {}): SourceDocument {
  const { title: extractedTitle, body } = extractTitle(markdown, options.title ?? "Untitled document");
  const title = options.title ?? extractedTitle;
  const content = stripMarkdownSyntax(body);
  const id = options.id ?? slugify(title);
  return {
    id,
    title,
    origin: options.origin ?? "markdown",
    content,
  };
}
