import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "contexo-sessions-test-"));
  vi.resetModules();
  process.env.CONTEXO_HOME = tmpDir;
  vi.spyOn(console, "log").mockImplementation(() => {});
  process.exitCode = undefined;
});

afterEach(async () => {
  const db = await import("../db.js");
  db.closeDb();
  delete process.env.CONTEXO_HOME;
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe("sessionsList", () => {
  it("prints a hint when there are no sessions", async () => {
    const { sessionsList } = await import("./sessions.js");
    sessionsList();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("No sessions yet"));
  });

  it("prints a row per session", async () => {
    const db = await import("../db.js");
    db.saveSession({ id: "row1", name: "my session", harnessSource: null, rawContext: "x", rawTokens: 5 });
    const { sessionsList } = await import("./sessions.js");
    sessionsList();
    const printed = (console.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]).join("\n");
    expect(printed).toContain("my session");
  });
});

describe("sessionShow", () => {
  it("prints session details for an exact id", async () => {
    const db = await import("../db.js");
    db.saveSession({ id: "showme", name: "detail test", harnessSource: "codex", rawContext: "body text", rawTokens: 3 });
    const { sessionShow } = await import("./sessions.js");
    sessionShow("showme");
    const printed = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join("\n");
    expect(printed).toContain("detail test");
    expect(printed).toContain("body text");
    expect(process.exitCode).toBeUndefined();
  });

  it("resolves an id prefix", async () => {
    const db = await import("../db.js");
    db.saveSession({ id: "abcdef99", name: "prefix hit", harnessSource: null, rawContext: "x", rawTokens: 1 });
    const { sessionShow } = await import("./sessions.js");
    sessionShow("abcdef");
    const printed = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join("\n");
    expect(printed).toContain("prefix hit");
  });

  it("sets a non-zero exit code and prints an error when not found", async () => {
    const { sessionShow } = await import("./sessions.js");
    sessionShow("doesnotexist");
    expect(process.exitCode).toBe(1);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("not found"));
  });
});

describe("sessionDelete", () => {
  it("deletes a matching session", async () => {
    const db = await import("../db.js");
    db.saveSession({ id: "todelete", name: "gone soon", harnessSource: null, rawContext: "x", rawTokens: 1 });
    const { sessionDelete } = await import("./sessions.js");
    sessionDelete("todelete");
    expect(db.getSession("todelete")).toBeUndefined();
    expect(process.exitCode).toBeUndefined();
  });

  it("sets a non-zero exit code when the session doesn't exist", async () => {
    const { sessionDelete } = await import("./sessions.js");
    sessionDelete("doesnotexist");
    expect(process.exitCode).toBe(1);
  });
});
