import { beforeEach, describe, expect, it } from "vitest";
import { MemoryUnansweredStore } from "../unanswered-store";

describe("MemoryUnansweredStore", () => {
  let store: MemoryUnansweredStore;

  beforeEach(() => {
    store = new MemoryUnansweredStore();
  });

  it("records a new open question", async () => {
    const q = await store.record("What is the max file size?", 0.05);
    expect(q.status).toBe("open");
    expect(q.bestScore).toBe(0.05);
    expect(q.resolvedAt).toBeNull();
  });

  it("de-duplicates identical open questions (case/whitespace-insensitive)", async () => {
    await store.record("What is the max file size?", 0.05);
    await store.record("  what is the MAX file size?  ", 0.02);
    const open = await store.list("open");
    expect(open).toHaveLength(1);
  });

  it("allows a question to be re-recorded after its prior occurrence was resolved", async () => {
    const first = await store.record("Same question", 0.05);
    await store.resolve(first.id);
    const second = await store.record("Same question", 0.05);
    expect(second.id).not.toBe(first.id);
    expect(await store.list("open")).toHaveLength(1);
  });

  it("resolve() moves a question to resolved with an optional note and timestamp", async () => {
    const q = await store.record("Question", 0.1);
    const resolved = await store.resolve(q.id, "Added a doc section for this.");
    expect(resolved?.status).toBe("resolved");
    expect(resolved?.resolutionNote).toBe("Added a doc section for this.");
    expect(resolved?.resolvedAt).not.toBeNull();
    expect(await store.list("open")).toEqual([]);
  });

  it("dismiss() moves a question to dismissed", async () => {
    const q = await store.record("Off-topic question", 0.1);
    const dismissed = await store.dismiss(q.id);
    expect(dismissed?.status).toBe("dismissed");
    expect(await store.list("dismissed")).toHaveLength(1);
  });

  it("resolve()/dismiss() return null for an unknown id", async () => {
    expect(await store.resolve("nope")).toBeNull();
    expect(await store.dismiss("nope")).toBeNull();
  });

  it("list() without a status returns everything, newest first", async () => {
    const a = await store.record("First", 0.1);
    await new Promise((r) => setTimeout(r, 2));
    const b = await store.record("Second", 0.1);
    const all = await store.list();
    expect(all.map((q) => q.id)).toEqual([b.id, a.id]);
  });

  it("clear() empties the store", async () => {
    await store.record("Q", 0.1);
    store.clear();
    expect(await store.list()).toEqual([]);
  });
});
