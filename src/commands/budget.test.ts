import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "contexo-budget-test-"));
  vi.resetModules();
  process.env.CONTEXO_HOME = tmpDir;
});

afterEach(async () => {
  const db = await import("../db.js");
  db.closeDb();
  delete process.env.CONTEXO_HOME;
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("budgetRun exit code", () => {
  it("resolves non-zero when the cap is hit and the child is killed, even though a signal-killed child reports code=null", async () => {
    const db = await import("../db.js");
    const { budgetRun } = await import("./budget.js");
    db.setBudget("daily", 1);
    const code = await budgetRun([
      "node",
      "-e",
      "console.log('spent $2.00'); setTimeout(() => {}, 5000);",
    ]);
    expect(code).not.toBe(0);
  });

  it("resolves 0 when the child exits cleanly and the cap is never hit", async () => {
    const db = await import("../db.js");
    const { budgetRun } = await import("./budget.js");
    db.setBudget("daily", 100);
    const code = await budgetRun(["node", "-e", "process.exit(0)"]);
    expect(code).toBe(0);
  });

  it("propagates the child's own non-zero exit code when the cap isn't hit", async () => {
    const db = await import("../db.js");
    const { budgetRun } = await import("./budget.js");
    db.setBudget("daily", 100);
    const code = await budgetRun(["node", "-e", "process.exit(3)"]);
    expect(code).toBe(3);
  });
});
