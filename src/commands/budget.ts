import { spawn } from "node:child_process";
import kleur from "kleur";
import { getBudget, setBudget, spendSince, recordRun } from "../db.js";
import { formatUsd } from "../cost.js";
import { randomUUID } from "node:crypto";

const DAY_MS = 24 * 60 * 60 * 1000;

export function budgetShow(): void {
  const daily = getBudget("daily");
  const spent = spendSince(Date.now() - DAY_MS);
  console.log(kleur.bold("Portal budget"));
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
      "  Note: enforcement requires wrapping your agent with `portal run -- <cmd>` " +
        "so Portal can watch spend and kill the process at the cap.",
    ),
  );
}

// Best-effort enforcement for the free tier: we tail stderr/stdout for
// well-known cost lines emitted by common agent CLIs, add them up, and kill
// the child when we cross the daily cap. Pro tier replaces this with a proper
// provider-side proxy for exact enforcement.
export function budgetRun(argv: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    if (argv.length === 0) return reject(new Error("Usage: portal run -- <command> [args...]"));
    const cap = getBudget("daily");
    if (cap === null) {
      console.log(kleur.yellow("!") + " No daily cap set. Running unbounded. Set one: portal budget --daily 5");
    }
    const [cmd, ...rest] = argv as [string, ...string[]];
    const child = spawn(cmd, rest, { stdio: ["inherit", "pipe", "pipe"], shell: false });

    const spent = { total: spendSince(Date.now() - DAY_MS) };
    const runId = randomUUID();

    const scanFor = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      process.stdout.write(chunk);
      const matches = text.matchAll(/\$([0-9]+\.[0-9]{2,4})/g);
      for (const m of matches) {
        const amt = Number.parseFloat(m[1]!);
        if (!Number.isNaN(amt) && amt < 100) {
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
        child.kill("SIGTERM");
      }
    };

    child.stdout.on("data", scanFor);
    child.stderr.on("data", (c) => {
      process.stderr.write(c);
      scanFor(c);
    });
    child.on("close", (code) => resolve(code ?? 0));
    child.on("error", reject);
  });
}
