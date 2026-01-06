import Link from "next/link";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-forge-amber">
          Self-hosted RAG answer bot
        </p>
        <h1 className="text-3xl font-semibold text-forge-text sm:text-4xl">ContextForge</h1>
        <p className="mt-3 max-w-2xl text-sm text-forge-dim sm:text-base">
          Point it at your docs, embed one script tag, and stop answering the same support question
          twice. Every answer cites the source it came from, and it says &ldquo;I don&rsquo;t know&rdquo;
          instead of guessing when your docs don&rsquo;t cover it.
        </p>
        <nav className="mt-5 flex gap-4 text-sm">
          <Link href="/ingest" className="text-forge-amber hover:underline">
            Ingest documents
          </Link>
          <Link href="/admin" className="text-forge-amber hover:underline">
            Review unanswered questions
          </Link>
        </nav>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <ChatPanel />

        <aside className="space-y-4">
          <Card>
            <CardHeader className="text-sm font-semibold text-forge-text">Demo knowledge base</CardHeader>
            <CardBody className="text-xs leading-relaxed text-forge-dim">
              This instance is seeded with the fictional &ldquo;Nimbus Notes&rdquo; support docs
              (billing, API keys, rate limits, exports, 2FA, webhooks, and more). Try a question those
              docs answer, then try one they don&rsquo;t &mdash; the bot should abstain instead of
              inventing an answer.
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="text-sm font-semibold text-forge-text">Embed it anywhere</CardHeader>
            <CardBody className="text-xs leading-relaxed text-forge-dim">
              <pre className="overflow-x-auto rounded bg-forge-bg p-2 text-[11px] text-forge-text">
                {'<script src="https://your-domain/widget.js"\n  data-endpoint="https://your-domain">\n</script>'}
              </pre>
              Drops a floating chat bubble onto any page, same-origin or cross-origin.
            </CardBody>
          </Card>
        </aside>
      </div>
    </main>
  );
}
