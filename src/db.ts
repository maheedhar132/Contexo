import Database from "better-sqlite3";
import { DB_PATH, ensureContexoHome } from "./paths.js";

export type SessionRow = {
  id: string;
  name: string;
  harness_source: string | null;
  raw_context: string;
  compressed_context: string | null;
  raw_tokens: number;
  compressed_tokens: number | null;
  created_at: number;
  updated_at: number;
};

export type RunRow = {
  id: string;
  session_id: string | null;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  ts: number;
};

let cached: Database.Database | null = null;

export function db(): Database.Database {
  if (cached) return cached;
  ensureContexoHome();
  const conn = new Database(DB_PATH);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  migrate(conn);
  cached = conn;
  return conn;
}

// For tests: releases the file handle so a temp CONTEXO_HOME dir can be
// removed cleanly (Windows keeps WAL-mode SQLite files locked otherwise).
export function closeDb(): void {
  cached?.close();
  cached = null;
}

function migrate(conn: Database.Database): void {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      harness_source TEXT,
      raw_context TEXT NOT NULL,
      compressed_context TEXT,
      raw_tokens INTEGER NOT NULL DEFAULT 0,
      compressed_tokens INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      ts INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS budgets (
      scope TEXT PRIMARY KEY,
      limit_usd REAL NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_runs_ts ON runs(ts);
    CREATE INDEX IF NOT EXISTS idx_runs_session ON runs(session_id);
  `);
}

export function saveSession(input: {
  id: string;
  name: string;
  harnessSource: string | null;
  rawContext: string;
  rawTokens: number;
}): void {
  const now = Date.now();
  db().prepare(
    `INSERT INTO sessions
       (id, name, harness_source, raw_context, raw_tokens, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       harness_source=excluded.harness_source,
       raw_context=excluded.raw_context,
       raw_tokens=excluded.raw_tokens,
       updated_at=excluded.updated_at`,
  ).run(input.id, input.name, input.harnessSource, input.rawContext, input.rawTokens, now, now);
}

export function setCompressed(id: string, compressed: string, tokens: number): void {
  db().prepare(
    `UPDATE sessions SET compressed_context=?, compressed_tokens=?, updated_at=? WHERE id=?`,
  ).run(compressed, tokens, Date.now(), id);
}

export function getSession(id: string): SessionRow | undefined {
  return db().prepare(`SELECT * FROM sessions WHERE id=?`).get(id) as SessionRow | undefined;
}

export function listSessions(limit = 20): SessionRow[] {
  return db()
    .prepare(`SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ?`)
    .all(limit) as SessionRow[];
}

export function deleteSession(id: string): void {
  db().prepare(`DELETE FROM sessions WHERE id=?`).run(id);
}

export function recordRun(row: Omit<RunRow, "ts">): void {
  db().prepare(
    `INSERT INTO runs (id, session_id, provider, model, input_tokens, output_tokens, cost_usd, ts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.session_id,
    row.provider,
    row.model,
    row.input_tokens,
    row.output_tokens,
    row.cost_usd,
    Date.now(),
  );
}

export function spendSince(sinceMs: number): number {
  const row = db()
    .prepare(`SELECT COALESCE(SUM(cost_usd), 0) AS total FROM runs WHERE ts >= ?`)
    .get(sinceMs) as { total: number };
  return row.total;
}

export function setBudget(scope: "daily" | "weekly" | "monthly", limitUsd: number): void {
  db().prepare(
    `INSERT INTO budgets (scope, limit_usd, created_at) VALUES (?, ?, ?)
     ON CONFLICT(scope) DO UPDATE SET limit_usd=excluded.limit_usd, created_at=excluded.created_at`,
  ).run(scope, limitUsd, Date.now());
}

export function getBudget(scope: "daily" | "weekly" | "monthly"): number | null {
  const row = db()
    .prepare(`SELECT limit_usd FROM budgets WHERE scope=?`)
    .get(scope) as { limit_usd: number } | undefined;
  return row?.limit_usd ?? null;
}
