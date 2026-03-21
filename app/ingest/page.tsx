"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

type IngestResult = { documentId: string; documentTitle: string; chunkCount: number };

export default function IngestPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-forge-amber hover:underline">
        &larr; Back
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-forge-text">Ingest documents</h1>
      <p className="mt-2 text-sm text-forge-dim">
        Paste markdown, fetch a URL, or upload a PDF. Each document is chunked, embedded, and made
        searchable immediately &mdash; try asking about it on the home page afterwards.
      </p>

      <div className="mt-8 space-y-6">
        <MarkdownForm />
        <UrlForm />
        <PdfForm />
      </div>
    </main>
  );
}

function ResultBanner({ result, error }: { result: IngestResult | null; error: string | null }) {
  if (error) return <p className="mt-3 text-sm text-red-400">{error}</p>;
  if (!result) return null;
  return (
    <p className="mt-3 text-sm text-forge-amber">
      Ingested &ldquo;{result.documentTitle}&rdquo; ({result.chunkCount} chunks).
    </p>
  );
}

function MarkdownForm() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "markdown", title, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to ingest.");
      setResult(data);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ingest.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-sm font-semibold text-forge-text">Paste markdown</CardHeader>
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional — inferred from a # heading otherwise)"
            className="w-full rounded-md border border-forge-border bg-forge-bg px-3 py-2 text-sm text-forge-text placeholder:text-forge-dim focus:border-forge-amber/60 focus:outline-none"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={"# How refunds work\n\nRefunds are issued within..."}
            rows={6}
            required
            className="w-full rounded-md border border-forge-border bg-forge-bg px-3 py-2 font-mono text-xs text-forge-text placeholder:text-forge-dim focus:border-forge-amber/60 focus:outline-none"
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Ingesting…" : "Ingest markdown"}
          </Button>
        </form>
        <ResultBanner result={result} error={error} />
      </CardBody>
    </Card>
  );
}

function UrlForm() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "url", url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to ingest.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ingest.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-sm font-semibold text-forge-text">Fetch a URL</CardHeader>
      <CardBody>
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.example.com/faq"
            type="url"
            required
            className="flex-1 rounded-md border border-forge-border bg-forge-bg px-3 py-2 text-sm text-forge-text placeholder:text-forge-dim focus:border-forge-amber/60 focus:outline-none"
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Fetching…" : "Ingest URL"}
          </Button>
        </form>
        <ResultBanner result={result} error={error} />
      </CardBody>
    </Card>
  );
}

function PdfForm() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/ingest", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to ingest.");
      setResult(data);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ingest.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-sm font-semibold text-forge-text">Upload a PDF</CardHeader>
      <CardBody>
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="flex-1 text-sm text-forge-dim file:mr-3 file:rounded-md file:border-0 file:bg-forge-border file:px-3 file:py-1.5 file:text-forge-text"
          />
          <Button type="submit" disabled={busy || !file}>
            {busy ? "Uploading…" : "Ingest PDF"}
          </Button>
        </form>
        <ResultBanner result={result} error={error} />
      </CardBody>
    </Card>
  );
}
