import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codex } from "./codex.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "contexo-codex-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("codex adapter", () => {
  it("does not detect an empty project", () => {
    expect(codex.detect(dir)).toBe(false);
  });

  it("detects a project with an existing AGENTS.md", () => {
    codex.writeContexoBlock(dir, "body");
    expect(codex.detect(dir)).toBe(true);
  });

  it("detects a project with a .codex directory even without AGENTS.md", () => {
    mkdirSync(join(dir, ".codex"));
    expect(codex.detect(dir)).toBe(true);
  });

  it("read() returns null when AGENTS.md doesn't exist", () => {
    expect(codex.read(dir)).toBeNull();
  });

  it("writeContexoBlock creates AGENTS.md and read() round-trips it", () => {
    const path = codex.writeContexoBlock(dir, "<!-- contexo:context:start -->\nbody\n<!-- contexo:context:end -->");
    expect(path).toBe(join(dir, "AGENTS.md"));
    const content = readFileSync(path, "utf8");
    expect(content).toContain("body");
    expect(codex.read(dir)).toBe(content);
  });

  it("writeContexoBlock preserves existing content outside the markers", () => {
    const path = join(dir, "AGENTS.md");
    writeFileSync(path, "# Agent instructions\n\nBe helpful.\n");
    codex.writeContexoBlock(dir, "<!-- contexo:context:start -->\nnew brief\n<!-- contexo:context:end -->");
    const content = readFileSync(path, "utf8");
    expect(content).toContain("# Agent instructions");
    expect(content).toContain("Be helpful.");
    expect(content).toContain("new brief");
  });
});
