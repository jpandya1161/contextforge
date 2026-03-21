import { sql } from "drizzle-orm";
import {
  customType,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * pgvector column type. Drizzle doesn't ship a first-class `vector` type, so
 * we declare one via `customType`, matching the pgvector extension's
 * `vector(n)` SQL type and its `<=>` (cosine distance) operator used in
 * lib/db/pg-vector-store.ts.
 */
const vector = (dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(",")}]`;
    },
    fromDriver(value: string): number[] {
      return value
        .slice(1, -1)
        .split(",")
        .filter((v) => v.length > 0)
        .map(Number);
    },
  });

export const EMBEDDING_DIMENSIONS = 1536;

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  origin: text("origin").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const chunks = pgTable(
  "chunks",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    documentTitle: text("document_title").notNull(),
    index: integer("index").notNull(),
    text: text("text").notNull(),
    embedding: vector(EMBEDDING_DIMENSIONS)("embedding").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    documentIdx: index("chunks_document_id_idx").on(table.documentId),
  }),
);

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    confidence: real("confidence"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    conversationIdx: index("messages_conversation_id_idx").on(table.conversationId),
  }),
);

/**
 * Every user question that was abstained on (low confidence) or explicitly
 * flagged gets logged here for the admin review loop described in the
 * README. Reviewers can attach a canonical answer, which becomes new
 * training material re-ingested as a document.
 */
export const unansweredQuestions = pgTable("unanswered_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  question: text("question").notNull(),
  bestScore: real("best_score").notNull(),
  status: text("status", { enum: ["open", "resolved", "dismissed"] })
    .notNull()
    .default("open"),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

/** Raw SQL for enabling the pgvector extension; run once per database. */
export const enablePgVectorExtensionSql = sql`CREATE EXTENSION IF NOT EXISTS vector`;
