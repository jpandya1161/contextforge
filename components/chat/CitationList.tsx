import type { Citation } from "@/lib/types";

/** Standalone source list, e.g. below a completed answer in a non-inline layout. */
export function CitationList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <ol className="mt-2 space-y-1 border-t border-forge-border pt-2 text-xs text-forge-dim">
      {citations.map((c) => (
        <li key={c.chunkId} className="flex gap-2">
          <span className="font-semibold text-forge-amber">[{c.marker}]</span>
          <span>
            <span className="text-forge-text">{c.documentTitle}</span> &mdash; {c.snippet}
          </span>
        </li>
      ))}
    </ol>
  );
}
