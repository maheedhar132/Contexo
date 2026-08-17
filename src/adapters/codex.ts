import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Adapter } from "./types.js";
import { replacePortalBlock } from "./types.js";

export const codex: Adapter = {
  id: "codex",
  displayName: "Codex CLI",
  configFileName: "AGENTS.md",
  detect(cwd) {
    return existsSync(join(cwd, "AGENTS.md")) || existsSync(join(cwd, ".codex"));
  },
  read(cwd) {
    const p = join(cwd, "AGENTS.md");
    return existsSync(p) ? readFileSync(p, "utf8") : null;
  },
  writePortalBlock(cwd, block) {
    const p = join(cwd, "AGENTS.md");
    const existing = existsSync(p) ? readFileSync(p, "utf8") : "";
    const next = replacePortalBlock(existing, block);
    writeFileSync(p, next, "utf8");
    return p;
  },
};
