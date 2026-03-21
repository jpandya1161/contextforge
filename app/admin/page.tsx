import Link from "next/link";
import { getSharedUnansweredStore, type UnansweredQuestion } from "@/lib/unanswered-store";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { dismissQuestion, resolveQuestion } from "./actions";

export const dynamic = "force-dynamic";

/**
 * The retraining-loop admin view: every question the bot abstained on
 * (or hallucinated an answer for) lands here so a human can either turn it
 * into new source material or dismiss it as out of scope.
 */
export default async function AdminPage() {
  const store = getSharedUnansweredStore();
  const [open, resolved, dismissed] = await Promise.all([
    store.list("open"),
    store.list("resolved"),
    store.list("dismissed"),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-forge-amber hover:underline">
        &larr; Back
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-forge-text">Unanswered questions</h1>
      <p className="mt-2 text-sm text-forge-dim">
        Questions the bot couldn&rsquo;t confidently answer from the indexed docs. Resolve one after
        adding the missing content via <Link href="/ingest" className="text-forge-amber hover:underline">Ingest</Link>,
        or dismiss it if it&rsquo;s out of scope.
      </p>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-forge-dim">
          Open ({open.length})
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-forge-dim">Nothing waiting on review.</p>
        ) : (
          <div className="space-y-3">
            {open.map((q) => (
              <OpenQuestionCard key={q.id} question={q} />
            ))}
          </div>
        )}
      </section>

      {(resolved.length > 0 || dismissed.length > 0) && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-forge-dim">History</h2>
          <div className="space-y-2">
            {[...resolved, ...dismissed]
              .sort((a, b) => (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? ""))
              .map((q) => (
                <div key={q.id} className="rounded border border-forge-border px-3 py-2 text-xs">
                  <span
                    className={
                      q.status === "resolved"
                        ? "mr-2 rounded bg-forge-amber/20 px-1.5 py-0.5 font-semibold text-forge-amber"
                        : "mr-2 rounded bg-forge-border px-1.5 py-0.5 font-semibold text-forge-dim"
                    }
                  >
                    {q.status}
                  </span>
                  <span className="text-forge-text">{q.question}</span>
                  {q.resolutionNote && <p className="mt-1 text-forge-dim">Note: {q.resolutionNote}</p>}
                </div>
              ))}
          </div>
        </section>
      )}
    </main>
  );
}

function OpenQuestionCard({ question }: { question: UnansweredQuestion }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <span className="text-sm text-forge-text">{question.question}</span>
        <span className="whitespace-nowrap text-xs text-forge-dim">
          confidence {question.bestScore.toFixed(2)}
        </span>
      </CardHeader>
      <CardBody className="space-y-2">
        <form action={resolveQuestion.bind(null, question.id)} className="flex gap-2">
          <input
            name="note"
            placeholder="How you resolved this (optional)"
            className="flex-1 rounded-md border border-forge-border bg-forge-bg px-2 py-1.5 text-xs text-forge-text placeholder:text-forge-dim focus:border-forge-amber/60 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-forge-amber px-3 py-1.5 text-xs font-medium text-forge-bg hover:bg-forge-amber/90"
          >
            Resolve
          </button>
        </form>
        <form action={dismissQuestion.bind(null, question.id)}>
          <button
            type="submit"
            className="rounded-md border border-forge-border px-3 py-1.5 text-xs text-forge-dim hover:text-forge-text"
          >
            Dismiss
          </button>
        </form>
      </CardBody>
    </Card>
  );
}
