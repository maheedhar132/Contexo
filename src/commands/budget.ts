import { spawn, type ChildProcess } from "node:child_process";
import kleur from "kleur";
import { getBudget, setBudget, spendSince, recordRun } from "../db.js";
import { formatUsd } from "../cost.js";
import { randomUUID } from "node:crypto";

const DAY_MS = 24 * 60 * 60 * 1000;

export function budgetShow(): void {
  const daily = getBudget("daily");
  const spent = spendSince(Date.now() - DAY_MS);
  console.log(kleur.bold("Contexo budget"));
  console.log(`  ${kleur.dim("daily cap")}   ${daily === null ? kleur.dim("(unset)") : formatUsd(daily)}`);
  console.log(`  ${kleur.dim("last 24h")}    ${formatUsd(spent)}`);
  if (daily !== null) {
    const pct = Math.min(100, Math.round((spent / daily) * 100));
    const bar = "█".repeat(Math.floor(pct / 5)) + "░".repeat(20 - Math.floor(pct / 5));
    const color = pct >= 90 ? kleur.red : pct >= 70 ? kleur.yellow : kleur.green;
    console.log(`  ${color(bar)} ${pct}%`);
  }
}

export function budgetSet(daily: number): void {
  if (!(daily > 0)) throw new Error("Daily cap must be a positive number of USD.");
  setBudget("daily", daily);
  console.log(kleur.green("✓") + ` Daily cap set to ${formatUsd(daily)}`);
  console.log(
    kleur.dim(
      "  Note: enforcement requires wrapping your agent with `contexo run -- <cmd>` " +
        "so Contexo can watch spend and kill the process at the cap. See `contexo run --help` " +
        "for the honest limits of this — it can only see cost the wrapped CLI prints to stdout/stderr.",
    ),
  );
}

// Kills the whole process tree, not just the immediate child — a wrapped
// CLI that forks its own workers/subprocesses could otherwise keep spending
// after we've "terminated" it.
function killProcessTree(child: ChildProcess): void {
  if (child.pid === undefined) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
}

// Best-effort enforcement for the free tier: we tail stderr/stdout for
// well-known cost lines emitted by common agent CLIs, add them up, and kill
// the child when we cross the daily cap. This is fundamentally reactive
// (we only see cost after the wrapped CLI prints it) and depends on the
// wrapped CLI's output format — if it never prints a recognizable `$X.XX`
// line, we cannot see its spend, and the cap silently does nothing. We
// surface that failure loudly (see the post-close warning below) instead
// of pretending enforcement happened. Pro tier replaces this with a proper
// provider-side proxy for exact, format-independent enforcement.
export function budgetRun(argv: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    if (argv.length === 0) return reject(new Error("Usage: contexo run -- <command> [args...]"));
    const cap = getBudget("daily");
    if (cap === null) {
      console.log(kleur.yellow("!") + " No daily cap set. Running unbounded. Set one: contexo budget --daily 5");
    }
    const [cmd, ...rest] = argv as [string, ...string[]];
    const child = spawn(cmd, rest, {
      stdio: ["inherit", "pipe", "pipe"],
      shell: false,
      detached: process.platform !== "win32",
    });

    const spent = { total: spendSince(Date.now() - DAY_MS) };
    const runId = randomUUID();
    let sawAnyCost = false;

    const scanFor = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      process.stdout.write(chunk);
      const matches = text.matchAll(/\$([0-9]+\.[0-9]{2,4})/g);
      for (const m of matches) {
        const amt = Number.parseFloat(m[1]!);
        if (!Number.isNaN(amt) && amt < 100) {
          sawAnyCost = true;
          spent.total += amt;
          recordRun({
            id: `${runId}-${Date.now()}`,
            session_id: null,
            provider: "unknown",
            model: "wrapped",
            input_tokens: 0,
            output_tokens: 0,
            cost_usd: amt,
          });
        }
      }
      if (cap !== null && spent.total >= cap) {
        console.log(
          kleur.red("\n! Budget cap hit ") +
            kleur.dim(`(${formatUsd(spent.total)} >= ${formatUsd(cap)}). Terminating.`),
        );
        killProcessTree(child);
      }
    };

    child.stdout.on("data", scanFor);
    child.stderr.on("data", (c) => {
      process.stderr.write(c);
      scanFor(c);
    });
    child.on("close", (code) => {
      if (cap !== null && !sawAnyCost) {
        console.log(
          kleur.yellow("\n! ") +
            "No cost output detected from this run — Contexo could not verify spend, " +
            "so the budget cap was NOT enforced. This CLI's output format isn't recognized " +
            "(see `contexo budget set` for details).",
        );
      }
      resolve(code ?? 0);
    });
    child.on("error", reject);
  });
}
