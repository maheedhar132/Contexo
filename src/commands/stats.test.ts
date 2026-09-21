import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "contexo-stats-test-"));
  vi.resetModules();
  process.env.CONTEXO_HOME = tmpDir;
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(async () => {
  const db = await import("../db.js");
  db.closeDb();
  delete process.env.CONTEXO_HOME;
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("statsCommand", () => {
  it("prints a hint when nothing has been compressed yet", async () => {
    const { statsCommand } = await import("./stats.js");
    statsCommand();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("No compressed sessions yet"));
  });

  it("prints the savings summary once a session has been compressed", async () => {
    const db = await import("../db.js");
    db.saveSession({ id: "s1", name: "compressed one", harnessSource: null, rawContext: "x".repeat(200), rawTokens: 200 });
    db.setCompressed("s1", "brief", 20);
    const { statsCommand } = await import("./stats.js");
    statsCommand();
    const printed = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join("\n");
    expect(printed).toContain("Contexo savings");
    expect(printed).toContain("180");
  });

  it("never prints a negative saved figure even when a brief is longer than the raw save", async () => {
    const db = await import("../db.js");
    db.saveSession({ id: "tiny", name: "tiny", harnessSource: null, rawContext: "fixed typo", rawTokens: 3 });
    db.setCompressed("tiny", "# Task\nFix a typo.\n\n# Next step\nDone.", 12);
    const { statsCommand } = await import("./stats.js");
    statsCommand();
    const printed = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join("\n");
    expect(printed).not.toContain("-$");
    expect(printed).not.toMatch(/saved\s+-\d/);
  });
});
