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

describe("session chains", () => {
  it("links a session to its parent and walks the full lineage oldest-first", async () => {
    const db = await import("./db.js");
    db.saveSession({ id: "c1", name: "claude leg", harnessSource: "claude-code", rawContext: "a", rawTokens: 1 });
    db.saveSession({
      id: "c2",
      name: "codex leg",
      harnessSource: "codex",
      rawContext: "b",
      rawTokens: 1,
      parentSessionId: "c1",
    });
    db.saveSession({
      id: "c3",
      name: "cursor leg",
      harnessSource: "cursor",
      rawContext: "c",
      rawTokens: 1,
      parentSessionId: "c2",
    });

    const chain = db.getSessionChain("c3");
    expect(chain.map((s) => s.id)).toEqual(["c1", "c2", "c3"]);
    expect(chain.map((s) => s.harness_source)).toEqual(["claude-code", "codex", "cursor"]);
  });

  it("a session with no parent is a chain of one", async () => {
    const db = await import("./db.js");
    db.saveSession({ id: "solo", name: "solo", harnessSource: null, rawContext: "x", rawTokens: 1 });
    expect(db.getSessionChain("solo").map((s) => s.id)).toEqual(["solo"]);
  });
});

describe("stats summary", () => {
  it("sums raw/compressed tokens only across compressed sessions", async () => {
    const db = await import("./db.js");
    expect(db.getStatsSummary()).toEqual({
      sessionsCompressed: 0,
      rawTokens: 0,
      compressedTokens: 0,
      tokensSaved: 0,
    });

    db.saveSession({ id: "u1", name: "uncompressed", harnessSource: null, rawContext: "a", rawTokens: 100 });
    db.saveSession({ id: "c1", name: "compressed", harnessSource: null, rawContext: "b", rawTokens: 200 });
    db.setCompressed("c1", "brief", 20);

    expect(db.getStatsSummary()).toEqual({
      sessionsCompressed: 1,
      rawTokens: 200,
      compressedTokens: 20,
      tokensSaved: 180,
    });
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
