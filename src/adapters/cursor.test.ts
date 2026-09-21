import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cursor } from "./cursor.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "contexo-cursor-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("cursor adapter", () => {
  it("does not detect an empty project", () => {
    expect(cursor.detect(dir)).toBe(false);
  });

  it("detects a project with an existing .cursorrules file", () => {
    writeFileSync(join(dir, ".cursorrules"), "");
    expect(cursor.detect(dir)).toBe(true);
  });

  it("detects a project with a .cursor directory", () => {
    mkdirSync(join(dir, ".cursor"));
    expect(cursor.detect(dir)).toBe(true);
  });

  it("without a .cursor directory, writes to the legacy .cursorrules path", () => {
    const path = cursor.writeContexoBlock(dir, "<!-- contexo:context:start -->\nbody\n<!-- contexo:context:end -->");
    expect(path).toBe(join(dir, ".cursorrules"));
    expect(existsSync(join(dir, ".cursorrules"))).toBe(true);
    expect(existsSync(join(dir, ".cursor"))).toBe(false);
  });

  it("with a .cursor directory already present, writes to .cursor/rules/contexo.mdc instead", () => {
    mkdirSync(join(dir, ".cursor"));
    const path = cursor.writeContexoBlock(dir, "<!-- contexo:context:start -->\nbody\n<!-- contexo:context:end -->");
    expect(path).toBe(join(dir, ".cursor", "rules", "contexo.mdc"));
    expect(readFileSync(path, "utf8")).toContain("body");
  });

  it("creates the .cursor/rules directory if it doesn't exist yet", () => {
    mkdirSync(join(dir, ".cursor"));
    expect(existsSync(join(dir, ".cursor", "rules"))).toBe(false);
    cursor.writeContexoBlock(dir, "x");
    expect(existsSync(join(dir, ".cursor", "rules"))).toBe(true);
  });

  it("read() prefers .cursor/rules/contexo.mdc over a stale legacy .cursorrules once .cursor exists", () => {
    writeFileSync(join(dir, ".cursorrules"), "legacy content");
    mkdirSync(join(dir, ".cursor"));
    cursor.writeContexoBlock(dir, "<!-- contexo:context:start -->\nnew content\n<!-- contexo:context:end -->");
    expect(cursor.read(dir)).toContain("new content");
    expect(cursor.read(dir)).not.toContain("legacy content");
  });

  it("read() returns null when neither path exists", () => {
    expect(cursor.read(dir)).toBeNull();
  });
});
