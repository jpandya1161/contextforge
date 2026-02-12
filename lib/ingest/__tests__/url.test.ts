import { describe, expect, it } from "vitest";
import { extractDocumentFromHtml } from "../url";

const SAMPLE_HTML = `
<!doctype html>
<html>
  <head><title>Nimbus Notes FAQ</title></head>
  <body>
    <nav>Home | Docs | Pricing</nav>
    <header>Top banner</header>
    <script>console.log("tracking");</script>
    <style>.hidden { display: none; }</style>
    <main>
      <h1>Frequently Asked Questions</h1>
      <p>Nimbus Notes syncs across devices automatically.</p>
      <ul>
        <li>First bullet point.</li>
        <li>Second bullet point.</li>
      </ul>
    </main>
    <footer>Copyright 2026</footer>
  </body>
</html>
`;

describe("extractDocumentFromHtml", () => {
  it("uses the <title> tag as the document title", () => {
    const doc = extractDocumentFromHtml(SAMPLE_HTML, "https://docs.example.com/faq");
    expect(doc.title).toBe("Nimbus Notes FAQ");
  });

  it("extracts visible text from headings, paragraphs, and list items", () => {
    const doc = extractDocumentFromHtml(SAMPLE_HTML, "https://docs.example.com/faq");
    expect(doc.content).toContain("Frequently Asked Questions");
    expect(doc.content).toContain("Nimbus Notes syncs across devices automatically.");
    expect(doc.content).toContain("First bullet point.");
    expect(doc.content).toContain("Second bullet point.");
  });

  it("strips script, style, nav, header, and footer chrome", () => {
    const doc = extractDocumentFromHtml(SAMPLE_HTML, "https://docs.example.com/faq");
    expect(doc.content).not.toContain("tracking");
    expect(doc.content).not.toContain("Home | Docs | Pricing");
    expect(doc.content).not.toContain("Top banner");
    expect(doc.content).not.toContain("Copyright 2026");
  });

  it("sets origin to the source URL", () => {
    const doc = extractDocumentFromHtml(SAMPLE_HTML, "https://docs.example.com/faq");
    expect(doc.origin).toBe("https://docs.example.com/faq");
  });

  it("derives a filesystem-safe id from the URL", () => {
    const doc = extractDocumentFromHtml(SAMPLE_HTML, "https://docs.example.com/faq");
    expect(doc.id).toBe("docs-example-com-faq");
  });

  it("falls back to <h1> when there is no <title>", () => {
    const html = "<html><body><h1>Fallback Heading</h1><p>Body text.</p></body></html>";
    const doc = extractDocumentFromHtml(html, "https://example.com/x");
    expect(doc.title).toBe("Fallback Heading");
  });
});
