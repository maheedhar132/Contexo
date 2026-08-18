import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Reads the real package.json version at runtime instead of hardcoding a
// string in two places (cli.ts's --version, mcp.ts's server info) that
// silently go stale on every release bump.
const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, "../package.json"), "utf8")) as { version: string };

export const VERSION = pkg.version;
