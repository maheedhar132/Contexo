import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Adapter } from "./types.js";
import { replacePortalBlock } from "./types.js";

export const claudeCode: Adapter = {
  id: "claude-code",
  displayName: "Claude Code",
  configFileName: "CLAUDE.md",
  detect(cwd) {
    return existsSync(join(cwd, "CLAUDE.md")) || existsSync(join(cwd, ".claude"));
  },
  read(cwd) {
    const p = join(cwd, "CLAUDE.md");
    return existsSync(p) ? readFileSync(p, "utf8") : null;
  },
  writePortalBlock(cwd, block) {
    const p = join(cwd, "CLAUDE.md");
    const existing = existsSync(p) ? readFileSync(p, "utf8") : "";
    const next = replacePortalBlock(existing, block);
    writeFileSync(p, next, "utf8");
    return p;
  },
};
