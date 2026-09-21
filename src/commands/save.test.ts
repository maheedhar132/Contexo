import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmpDir: string;
let projDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "contexo-save-test-"));
  projDir = mkdtempSync(join(tmpdir(), "contexo-save-proj-"));
  vi.resetModules();
  process.env.CONTEXO_HOME = tmpDir;
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(async () => {
  const db = await import("../db.js");
  db.closeDb();
  delete process.env.CONTEXO_HOME;
  rmSync(tmpDir, { recursive: true, force: true });
  rmSync(projDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("saveCommand", () => {
  it("saves inline --text and persists it", async () => {
    const { saveCommand } = await import("./save.js");
    const db = await import("../db.js");
    const { id, tokens } = await saveCommand({ text: "hello world", cwd: projDir });
    expect(tokens).toBeGreaterThan(0);
    const row = db.getSession(id);
    expect(row?.raw_context).toBe("hello world");
  });

  it("reads from --file", async () => {
    const { saveCommand } = await import("./save.js");
    const filePath = join(projDir, "notes.txt");
    writeFileSync(filePath, "context from a file");
    const { id } = await saveCommand({ file: filePath, cwd: projDir });
    const db = await import("../db.js");
    expect(db.getSession(id)?.raw_context).toBe("context from a file");
  });

  it("throws on empty/whitespace-only input", async () => {
    const { saveCommand } = await import("./save.js");
    await expect(saveCommand({ text: "   ", cwd: projDir })).rejects.toThrow(/No context provided/);
  });

  it("detects the harness from the target directory", async () => {
    writeFileSync(join(projDir, "CLAUDE.md"), "# hi");
    const { saveCommand } = await import("./save.js");
    const { id } = await saveCommand({ text: "some context", cwd: projDir });
    const db = await import("../db.js");
    expect(db.getSession(id)?.harness_source).toBe("claude-code");
  });

  it("chains onto a prior session via --continues (id or prefix)", async () => {
    const { saveCommand } = await import("./save.js");
    const db = await import("../db.js");
    const first = await saveCommand({ text: "first leg", cwd: projDir });
    const second = await saveCommand({ text: "second leg", cwd: projDir, continues: first.id.slice(0, 8) });
    expect(db.getSession(second.id)?.parent_session_id).toBe(first.id);
  });

  it("throws when --continues doesn't match any session", async () => {
    const { saveCommand } = await import("./save.js");
    await expect(saveCommand({ text: "x", cwd: projDir, continues: "nomatch99" })).rejects.toThrow(
      /no matching session found/,
    );
  });
});
