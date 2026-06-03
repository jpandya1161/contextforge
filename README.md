# ContextForge

**A self-hostable docs answer bot that cites its sources and admits when it doesn't know.**

![ContextForge](assets/hero.png)

## The problem

Small teams can't afford Glean or Intercom Fin, but they still drown in the same handful of questions their docs already answer - "how do I rotate an API key," "what's the refund policy," "why did my webhook stop firing." Hiring more support headcount doesn't scale, and a generic chatbot that confidently makes things up is worse than no bot at all: it erodes trust and creates support tickets of its own.

ContextForge is a small, self-hostable RAG (retrieval-augmented generation) service you can point at your own docs - markdown, PDFs, or a URL - that answers questions grounded in and citing those docs, and explicitly abstains ("I don't know, but I've logged this for the team") when its retrieval confidence is too low to trust an answer. It ships as an embeddable widget (one <script> tag), a chat demo page, and an admin queue of unanswered questions that turns every "I don't know" into a prioritized backlog for improving the docs.

## How it works

```mermaid
flowchart LR
    subgraph Ingestion
        A[Markdown / PDF / URL] --> B[Normalize to plain text]
        B --> C[Chunk by section<br/>+ overlap on long sections]
        C --> D[Embed each chunk]
        D --> E[(Vector store<br/>Postgres+pgvector or in-memory)]
    end

    subgraph "Ask a question"
        F[User question] --> G[Embed query]
        G --> H[Top-k similarity search]
        H --> E
        H --> I{Top score >=<br/>confidence threshold?}
        I -- No --> J[Abstain<br/>+ log to review queue]
        I -- Yes --> K[Generate answer<br/>grounded in retrieved chunks]
        K --> L{Every citation<br/>marker retrieved?}
        L -- No, hallucinated --> J
        L -- Yes --> M[Streamed answer<br/>with numbered citations]
    end

    J --> N[Admin: unanswered<br/>questions queue]
```

Two swappable pairs of providers back this, selected automatically from environment configuration:

- **Embeddings**: a free, offline, deterministic TF-IDF-over-feature-hashing embedder by default (`lib/embeddings.ts`); switches to OpenAI's text-embedding-3-small when OPENAI_API_KEY is set.
- **Answer generation**: a free, hallucination-proof extractive answerer by default (it only ever emits sentences lifted verbatim from retrieved chunks - `lib/answer-providers.ts`); switches to Claude (via the Vercel AI SDK) when ANTHROPIC_API_KEY is set, for more fluent prose.
- **Vector store**: an in-memory store for local dev/demo/CI; Postgres + pgvector (`lib/db/pg-vector-store.ts`, via Drizzle ORM) when DATABASE_URL is set.

This means the app runs - and its whole test suite passes - with zero API keys, zero network access, and zero running database, which is also exactly what makes it cheap to self-host for a team that doesn't want a $50k/year vendor contract.

## Quick start

```bash
npm install
npm run dev
# -> http://localhost:3000
```

The dev server seeds itself with a bundled fictional support KB ("Nimbus Notes" - billing, API keys, rate limits, 22FA, webhooks, exports, and more) the first time it's queried, so the chat demo on / works immediately with no setup. Try /ingest to add your own markdown/PDF/URL, and /admin to see the review queue fill up when you ask something out of scope.

To embed the widget on any page:

```html
<script src="https://your-domain/widget.js" data-endpoint="https://your-domain"></script>
```

### Running against a real LLM + Postgres

```bash
cp .env.example .env   # if you add one; otherwise export these directly
export DATABASE_URL="postgres://user:pass@host:5432/contextforge"
export ANTHROPIC_API_KEY="sk-ant-..."   # or OPENAI_API_KEY for embeddings
npm run db:generate && npm run db:migrate
npm run dev
```

### Tests and the eval harness

```bash
npm test        # vitest - fully offline, mocked/in-memory throughout
npm run eval    # runs eval/dataset.json (26 golden Q&A pairs) through the real pipeline
                # and prints accuracy / hallucination-rate / abstain-behavior metrics
```

The eval harness (eval/harness.ts) is also exercised inside the test suite (eval/__tests__/golden-dataset.test.ts), asserting a 0% hallucination rate and a minimum accuracy bar on the free offline pipeline, so a retrieval or abstain-threshold regression fails CI before it ships.

## Project structure

```
app/                  Next.js App Router: landing/chat demo, /ingest, /admin, API routes
components/            Chat UI (source-highlighted citations) and shared UI primitives
lib/                    Core RAG pipeline: chunking, embeddings, retrieval, citations, abstain logic
lib/ingest/             Markdown / PDF / URL -> normalized SourceDocument
lib/db/                 Drizzle schema + Postgres/pgvector-backed VectorStore
widget/                 Vanilla-JS embeddable chat widget, bundled with esbuild -> public/widget.js
eval/                   Golden Q&A dataset + eval harness (accuracy / hallucination-rate reporting)
fixtures/docs/          Bundled demo knowledge base ("Nimbus Notes")
```

## Design notes / limitations

- The default embedder is lexical (TF-IDF + hashing), not a neural embedding model - it's real and measurably better than keyword search, but won't catch pure paraphrase with zero shared vocabulary the way a neural embedding would. Configure OPENAI_API_KEY for that.
- Streaming is "stream the already-computed answer" rather than token-by-token LLM streaming when running the free extractive provider (which isn't autoregressive); the Anthropic provider path is a drop-in swap and the streaming framing (lib/chat-stream.ts) doesn't change either way.
- PDF and URL ingestion aren't covered by the default offline npm test where they'd require real files/network beyond what's practical to fixture; lib/ingest/url.ts's HTML-extraction logic is unit tested against a fixture HTML string, and the PDF/URL network calls are thin, isolated wrappers.
- lib/db/__tests__/pg-vector-store.integration.test.ts covers the Postgres-backed store but is skipped by default (no Docker/DB in CI); run it locally with a real DATABASE_URL and RUN_DB_INTEGRATION=1 npm test.

## Maintainer

ContextForge is maintained by Jay Pandya. Jay is an AI/ML Engineer with over 4 years of experience specializing in Generative AI, RAG architectures, and scalable machine learning systems. He focuses on building high-performance AI applications that transform complex data into actionable business insights.

Contact: jaypandya1161@gmail.com

## License

MIT - see [LICENSE](LICENSE).