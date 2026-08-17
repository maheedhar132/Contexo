import kleur from "kleur";
import { listSessions, getSession, deleteSession } from "../db.js";

export function sessionsList(): void {
  const rows = listSessions(20);
  if (rows.length === 0) {
    console.log(kleur.dim("No sessions yet. Try: portal save --text \"your context\""));
    return;
  }
  for (const r of rows) {
    const compressed = r.compressed_tokens
      ? kleur.green(`→ ${r.compressed_tokens.toLocaleString()}`)
      : kleur.dim("(uncompressed)");
    console.log(
      `${kleur.bold(r.id.slice(0, 8))}  ${r.name.padEnd(28)}  ` +
        `${kleur.dim(r.raw_tokens.toLocaleString().padStart(7))}  ${compressed}`,
    );
  }
}

export function sessionShow(id: string): void {
  const s = getSession(id) ?? getSession(findByPrefix(id) ?? id);
  if (!s) {
    console.log(kleur.red(`Session ${id} not found.`));
    process.exitCode = 1;
    return;
  }
  console.log(kleur.bold(s.name));
  console.log(`${kleur.dim("id")}          ${s.id}`);
  console.log(`${kleur.dim("source")}      ${s.harness_source ?? "(unknown)"}`);
  console.log(`${kleur.dim("raw tokens")}  ${s.raw_tokens.toLocaleString()}`);
  if (s.compressed_tokens) {
    const ratio = ((1 - s.compressed_tokens / s.raw_tokens) * 100).toFixed(1);
    console.log(`${kleur.dim("compressed")}  ${s.compressed_tokens.toLocaleString()} (${ratio}% smaller)`);
  }
  console.log();
  console.log(s.compressed_context ?? s.raw_context);
}

export function sessionDelete(id: string): void {
  const resolved = findByPrefix(id) ?? id;
  const s = getSession(resolved);
  if (!s) {
    console.log(kleur.red(`Session ${id} not found.`));
    process.exitCode = 1;
    return;
  }
  deleteSession(resolved);
  console.log(kleur.green("✓") + ` Deleted ${resolved.slice(0, 8)} (${s.name})`);
}

function findByPrefix(prefix: string): string | null {
  const rows = listSessions(500);
  const match = rows.find((r) => r.id.startsWith(prefix));
  return match?.id ?? null;
}
