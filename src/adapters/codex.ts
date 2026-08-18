import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Adapter } from "./types.js";
import { replaceContexoBlock } from "./types.js";

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
  writeContexoBlock(cwd, block) {
    const p = join(cwd, "AGENTS.md");
    const existing = existsSync(p) ? readFileSync(p, "utf8") : "";
    const next = replaceContexoBlock(existing, block);
    writeFileSync(p, next, "utf8");
    return p;
  },
};
