import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

// CONTEXO_HOME can be overridden (e.g. by tests, to isolate the DB per test
// run instead of touching the real ~/.contexo on disk).
export const CONTEXO_HOME = process.env.CONTEXO_HOME ?? join(homedir(), ".contexo");
export const DB_PATH = join(CONTEXO_HOME, "contexo.db");
export const LOGS_DIR = join(CONTEXO_HOME, "logs");

export function ensureContexoHome(): void {
  mkdirSync(CONTEXO_HOME, { recursive: true });
}

export function ensureLogsDir(): void {
  mkdirSync(LOGS_DIR, { recursive: true });
}
