import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeCode } from "./claude-code.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "contexo-claude-code-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("claudeCode adapter", () => {
  it("does not detect an empty project", () => {
    expect(claudeCode.detect(dir)).toBe(false);
  });

  it("detects a project with an existing CLAUDE.md", () => {
    claudeCode.writeContexoBlock(dir, "body");
    expect(claudeCode.detect(dir)).toBe(true);
  });

  it("detects a project with a .claude directory even without CLAUDE.md", () => {
    mkdirSync(join(dir, ".claude"));
    expect(claudeCode.detect(dir)).toBe(true);
  });

  it("read() returns null when CLAUDE.md doesn't exist", () => {
    expect(claudeCode.read(dir)).toBeNull();
  });

  it("writeContexoBlock creates CLAUDE.md and read() round-trips it", () => {
    const path = claudeCode.writeContexoBlock(dir, "<!-- contexo:context:start -->\nbody\n<!-- contexo:context:end -->");
    expect(path).toBe(join(dir, "CLAUDE.md"));
    const content = readFileSync(path, "utf8");
    expect(content).toContain("body");
    expect(claudeCode.read(dir)).toBe(content);
  });

  it("writeContexoBlock preserves existing content outside the markers", () => {
    const path = join(dir, "CLAUDE.md");
    writeFileSync(path, "# My Project\n\nSome existing notes.\n");
    claudeCode.writeContexoBlock(dir, "<!-- contexo:context:start -->\nnew brief\n<!-- contexo:context:end -->");
    const content = readFileSync(path, "utf8");
    expect(content).toContain("# My Project");
    expect(content).toContain("Some existing notes.");
    expect(content).toContain("new brief");
  });
});
