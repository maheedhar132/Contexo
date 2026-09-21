import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmpDir: string;
let projDir: string;
let savedApiKey: string | undefined;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "contexo-handoff-test-"));
  projDir = mkdtempSync(join(tmpdir(), "contexo-handoff-proj-"));
  vi.resetModules();
  process.env.CONTEXO_HOME = tmpDir;
  // Deterministically exercise the no-key fallback path — never hit the
  // real Anthropic API from a test.
  savedApiKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  vi.spyOn(console, "log").mockImplementation(() => {});
  process.exitCode = undefined;
});

afterEach(async () => {
  const db = await import("../db.js");
  db.closeDb();
  delete process.env.CONTEXO_HOME;
  if (savedApiKey !== undefined) process.env.ANTHROPIC_API_KEY = savedApiKey;
  rmSync(tmpDir, { recursive: true, force: true });
  rmSync(projDir, { recursive: true, force: true });
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe("handoffCommand", () => {
  it("reports a specific message and exits non-zero for a session id that doesn't match", async () => {
    const { handoffCommand } = await import("./handoff.js");
    await handoffCommand("claude-code", { session: "nosuchsession", cwd: projDir });
    expect(process.exitCode).toBe(1);
    const printed = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join("\n");
    expect(printed).toContain("Session nosuchsession not found.");
  });

  it("reports the generic message and exits non-zero when there are no sessions at all", async () => {
    const { handoffCommand } = await import("./handoff.js");
    await handoffCommand("claude-code", { cwd: projDir });
    expect(process.exitCode).toBe(1);
    const printed = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join("\n");
    expect(printed).toContain("No session found");
  });

  it("falls back to raw context and writes CLAUDE.md when no ANTHROPIC_API_KEY is set", async () => {
    const db = await import("../db.js");
    db.saveSession({ id: "s1", name: "leg", harnessSource: null, rawContext: "did the thing", rawTokens: 3 });
    const { handoffCommand } = await import("./handoff.js");
    await handoffCommand("claude-code", { session: "s1", cwd: projDir });
    const content = readFileSync(join(projDir, "CLAUDE.md"), "utf8");
    expect(content).toContain("did the thing");
    expect(content).toContain("<!-- contexo:context:start -->");
  });

  it("--skip-compression writes raw context without attempting any compression", async () => {
    const db = await import("../db.js");
    db.saveSession({ id: "s1", name: "leg", harnessSource: null, rawContext: "raw only", rawTokens: 2 });
    const { handoffCommand } = await import("./handoff.js");
    await handoffCommand("codex", { session: "s1", cwd: projDir, skipCompression: true });
    const content = readFileSync(join(projDir, "AGENTS.md"), "utf8");
    expect(content).toContain("raw only");
    const printed = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join("\n");
    expect(printed).not.toContain("Compressing");
  });

  it("writes a cumulative handoff covering an entire --continues chain", async () => {
    const db = await import("../db.js");
    const { saveCommand } = await import("./save.js");
    const first = await saveCommand({ text: "leg one", cwd: projDir, name: "leg1" });
    await saveCommand({ text: "leg two", cwd: projDir, name: "leg2", continues: first.id });
    const { handoffCommand } = await import("./handoff.js");
    await handoffCommand("claude-code", { cwd: projDir });
    const content = readFileSync(join(projDir, "CLAUDE.md"), "utf8");
    expect(content).toContain("leg one");
    expect(content).toContain("leg two");
    const printed = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join("\n");
    expect(printed).toContain("cumulative across 2 sessions");
    void db;
  });

  it("diffs against an existing handoff block already in the target file on a second run", async () => {
    const db = await import("../db.js");
    db.saveSession({ id: "s1", name: "first", harnessSource: null, rawContext: "first save", rawTokens: 2 });
    const { handoffCommand } = await import("./handoff.js");
    await handoffCommand("claude-code", { session: "s1", cwd: projDir });

    db.saveSession({ id: "s2", name: "second", harnessSource: null, rawContext: "second save", rawTokens: 2 });
    await handoffCommand("claude-code", { session: "s2", cwd: projDir });

    const printed = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join("\n");
    expect(printed).toContain("diffed against the existing handoff already in this file");
  });
});
