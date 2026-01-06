import * as cheerio from "cheerio";
import type { SourceDocument } from "../types";

function slugifyUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 100);
  } catch {
    return url.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 100);
  }
}

/**
 * Converts raw HTML into a `SourceDocument`: strips scripts/styles/nav/
 * footer chrome, then extracts visible text with paragraph breaks
 * preserved so the chunker still respects structure.
 */
export function extractDocumentFromHtml(html: string, url: string): SourceDocument {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, header, svg, iframe").remove();

  const title = $("title").first().text().trim() || $("h1").first().text().trim() || url;

  const blocks: string[] = [];
  $("h1, h2, h3, h4, p, li").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length > 0) blocks.push(text);
  });

  const content = blocks.join("\n\n");

  return {
    id: slugifyUrl(url),
    title,
    origin: url,
    content: content || $("body").text().replace(/\s+/g, " ").trim(),
  };
}

/**
 * Fetches a URL and extracts a `SourceDocument` from it. Not used at test
 * time (requires network); `extractDocumentFromHtml` above is the unit that
 * gets exercised directly against fixture HTML strings.
 */
export async function ingestUrl(url: string): Promise<SourceDocument> {
  const res = await fetch(url, { headers: { "User-Agent": "ContextForgeBot/1.0" } });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const html = await res.text();
  return extractDocumentFromHtml(html, url);
}
