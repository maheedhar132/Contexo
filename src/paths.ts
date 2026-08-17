import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

export const PORTAL_HOME = join(homedir(), ".portal");
export const DB_PATH = join(PORTAL_HOME, "portal.db");

export function ensurePortalHome(): void {
  mkdirSync(PORTAL_HOME, { recursive: true });
}
