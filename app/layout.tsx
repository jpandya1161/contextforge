import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContextForge — self-hosted docs answer bot",
  description:
    "A self-hostable RAG answer bot that cites its sources and abstains when it isn't confident. " +
    "Ingest your docs, embed a chat widget, and stop answering the same question twice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
