import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "contexo-test-"));
  vi.resetModules();
  process.env.CONTEXO_HOME = tmpDir;
});

afterEach(async () => {
  const db = await import("./db.js");
  db.closeDb();
  delete process.env.CONTEXO_HOME;
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("sessions", () => {
  it("saves, lists, and deletes a session", async () => {
    const db = await import("./db.js");
    db.saveSession({ id: "s1", name: "test", harnessSource: null, rawContext: "hello", rawTokens: 2 });
    expect(db.getSession("s1")?.name).toBe("test");
    expect(db.listSessions()).toHaveLength(1);
    db.deleteSession("s1");
    expect(db.getSession("s1")).toBeUndefined();
  });
});

describe("budgets and runs", () => {
  it("sets/gets a budget and sums spend since a timestamp", async () => {
    const db = await import("./db.js");
    expect(db.getBudget("daily")).toBeNull();
    db.setBudget("daily", 5);
    expect(db.getBudget("daily")).toBe(5);
    db.recordRun({
      id: "r1",
      session_id: null,
      provider: "unknown",
      model: "wrapped",
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 1.5,
    });
    expect(db.spendSince(Date.now() - 60_000)).toBe(1.5);
  });
});
