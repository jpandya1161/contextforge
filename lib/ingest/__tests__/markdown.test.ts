import { describe, expect, it } from "vitest";
import { ingestMarkdown } from "../markdown";

describe("ingestMarkdown", () => {
  it("extracts the title from a leading # heading and strips it from the body", () => {
    const doc = ingestMarkdown("# Billing and Plans\n\nSome content here.");
    expect(doc.title).toBe("Billing and Plans");
    expect(doc.content).not.toContain("# Billing and Plans");
    expect(doc.content).toContain("Some content here.");
  });

  it("falls back to a default title when there is no heading and none was supplied", () => {
    const doc = ingestMarkdown("Just a paragraph, no heading.");
    expect(doc.title).toBe("Untitled document");
  });

  it("uses an explicitly supplied title over any inferred heading", () => {
    const doc = ingestMarkdown("# Inferred Title\n\nBody.", { title: "Explicit Title" });
    expect(doc.title).toBe("Explicit Title");
  });

  it("slugifies the title into an id when none is supplied", () => {
    const doc = ingestMarkdown("# Two Factor Auth!\n\nBody.");
    expect(doc.id).toBe("two-factor-auth");
  });

  it("uses an explicitly supplied id over the slugified title", () => {
    const doc = ingestMarkdown("# Title\n\nBody.", { id: "custom-id" });
    expect(doc.id).toBe("custom-id");
  });

  it("strips bold, italic, inline code, and link syntax while preserving the text", () => {
    const doc = ingestMarkdown("# T\n\nThis is **bold**, *italic*, `code`, and a [link](https://example.com).");
    expect(doc.content).toContain("This is bold, italic, code, and a link (https://example.com).");
  });

  it("unwraps fenced code blocks but keeps their content", () => {
    const doc = ingestMarkdown("# T\n\n```js\nconst x = 1;\n```");
    expect(doc.content).not.toContain("```");
    expect(doc.content).toContain("const x = 1;");
  });

  it("defaults origin to 'markdown' and respects an explicit origin", () => {
    const a = ingestMarkdown("# T\n\nBody.");
    expect(a.origin).toBe("markdown");
    const b = ingestMarkdown("# T\n\nBody.", { origin: "fixtures/docs/t.md" });
    expect(b.origin).toBe("fixtures/docs/t.md");
  });
});
