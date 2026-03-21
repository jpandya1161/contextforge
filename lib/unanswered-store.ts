export interface UnansweredQuestion {
  id: string;
  question: string;
  bestScore: number;
  status: "open" | "resolved" | "dismissed";
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface UnansweredStore {
  record(question: string, bestScore: number): Promise<UnansweredQuestion>;
  list(status?: UnansweredQuestion["status"]): Promise<UnansweredQuestion[]>;
  resolve(id: string, note?: string): Promise<UnansweredQuestion | null>;
  dismiss(id: string): Promise<UnansweredQuestion | null>;
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `uq_${Date.now().toString(36)}_${idCounter}`;
}

/**
 * In-memory implementation of the admin "unanswered questions" review
 * queue. Every abstained (or low-confidence) question the bot receives
 * lands here so a human can review it and turn it into new source
 * material -- the retraining loop referenced in the README. Swappable for
 * a Postgres-backed implementation (see lib/db/schema.ts:unansweredQuestions)
 * without changing any caller.
 */
export class MemoryUnansweredStore implements UnansweredStore {
  private items = new Map<string, UnansweredQuestion>();

  async record(question: string, bestScore: number): Promise<UnansweredQuestion> {
    // De-duplicate near-identical repeated questions by exact text match so
    // the review queue doesn't fill up with the same FAQ over and over.
    const existing = [...this.items.values()].find(
      (q) => q.question.trim().toLowerCase() === question.trim().toLowerCase() && q.status === "open",
    );
    if (existing) return existing;

    const record: UnansweredQuestion = {
      id: nextId(),
      question,
      bestScore,
      status: "open",
      resolutionNote: null,
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    };
    this.items.set(record.id, record);
    return record;
  }

  async list(status?: UnansweredQuestion["status"]): Promise<UnansweredQuestion[]> {
    const all = [...this.items.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return status ? all.filter((q) => q.status === status) : all;
  }

  async resolve(id: string, note?: string): Promise<UnansweredQuestion | null> {
    const item = this.items.get(id);
    if (!item) return null;
    item.status = "resolved";
    item.resolutionNote = note ?? null;
    item.resolvedAt = new Date().toISOString();
    return item;
  }

  async dismiss(id: string): Promise<UnansweredQuestion | null> {
    const item = this.items.get(id);
    if (!item) return null;
    item.status = "dismissed";
    item.resolvedAt = new Date().toISOString();
    return item;
  }

  clear(): void {
    this.items.clear();
  }
}

let sharedStore: MemoryUnansweredStore | null = null;

export function getSharedUnansweredStore(): MemoryUnansweredStore {
  if (!sharedStore) sharedStore = new MemoryUnansweredStore();
  return sharedStore;
}
