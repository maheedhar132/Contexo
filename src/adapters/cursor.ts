import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Adapter } from "./types.js";
import { replacePortalBlock } from "./types.js";

// Cursor evolved from .cursorrules (legacy, still respected) to
// .cursor/rules/*.mdc (newer). We prefer .cursor/rules/portal.mdc when the
// .cursor directory already exists, and fall back to .cursorrules otherwise
// to avoid breaking users still on the legacy path.
function preferredPath(cwd: string): string {
  const rulesDir = join(cwd, ".cursor", "rules");
  if (existsSync(join(cwd, ".cursor"))) return join(rulesDir, "portal.mdc");
  return join(cwd, ".cursorrules");
}

export const cursor: Adapter = {
  id: "cursor",
  displayName: "Cursor",
  configFileName: ".cursorrules or .cursor/rules/portal.mdc",
  detect(cwd) {
    return (
      existsSync(join(cwd, ".cursorrules")) ||
      existsSync(join(cwd, ".cursor")) ||
      existsSync(join(cwd, ".cursor", "rules"))
    );
  },
  read(cwd) {
    const p = preferredPath(cwd);
    return existsSync(p) ? readFileSync(p, "utf8") : null;
  },
  writePortalBlock(cwd, block) {
    const p = preferredPath(cwd);
    if (p.includes(".cursor")) mkdirSync(join(cwd, ".cursor", "rules"), { recursive: true });
    const existing = existsSync(p) ? readFileSync(p, "utf8") : "";
    const next = replacePortalBlock(existing, block);
    writeFileSync(p, next, "utf8");
    return p;
  },
};
