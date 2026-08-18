import kleur from "kleur";
import { getSession, listSessions, setCompressed } from "../db.js";
import { getAdapter, wrapContexoBlock, type HarnessId } from "../adapters/index.js";
import { compressContext } from "../compress.js";
import { countTokens, formatUsd, type ModelId } from "../cost.js";

export type HandoffOptions = {
  session?: string;
  cwd?: string;
  apiKey?: string;
  skipCompression?: boolean;
};

export async function handoffCommand(target: HarnessId, opts: HandoffOptions = {}): Promise<void> {
  const cwd = opts.cwd ?? process.cwd();
  const sessionRow = resolveSession(opts.session);
  if (!sessionRow) {
    console.log(kleur.red("No session found. Save one first: contexo save --file <path>"));
    process.exitCode = 1;
    return;
  }

  let body = opts.skipCompression ? null : sessionRow.compressed_context;
  let compressedTokens = opts.skipCompression ? sessionRow.raw_tokens : sessionRow.compressed_tokens ?? 0;

  if (!body && !opts.skipCompression) {
    console.log(kleur.dim("Compressing (using your ANTHROPIC_API_KEY, ~$0.001 per compression)..."));
    try {
      const result = await compressContext(sessionRow.raw_context, opts.apiKey);
      body = result.compressed;
      compressedTokens = countTokens(body, "claude-sonnet-4-5" as ModelId);
      setCompressed(sessionRow.id, body, compressedTokens);
      const compressionCost = (result.inputTokens * 1 + result.outputTokens * 5) / 1_000_000;
      console.log(
        kleur.dim(
          `  compression: ${result.inputTokens} in → ${result.outputTokens} out ` +
            `(${formatUsd(compressionCost)})`,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(kleur.yellow("! ") + msg);
      console.log(kleur.dim("Falling back to raw context (larger, but still works)."));
      body = sessionRow.raw_context;
      compressedTokens = sessionRow.raw_tokens;
    }
  }

  const block = wrapContexoBlock(body ?? sessionRow.raw_context, sessionRow.id, sessionRow.harness_source);
  const adapter = getAdapter(target);
  const writtenTo = adapter.writeContexoBlock(cwd, block);

  console.log(
    kleur.green("✓") +
      ` Handoff ready: ${kleur.bold(adapter.displayName)}` +
      kleur.dim(` (${writtenTo})`),
  );
  const savedPct =
    sessionRow.raw_tokens > 0 && compressedTokens > 0
      ? ((1 - compressedTokens / sessionRow.raw_tokens) * 100).toFixed(1)
      : null;
  console.log(
    `  ${kleur.dim("raw")}         ${sessionRow.raw_tokens.toLocaleString()} tokens\n` +
      `  ${kleur.dim("handoff")}     ${compressedTokens.toLocaleString()} tokens` +
      (savedPct ? kleur.green(`  (-${savedPct}%)`) : ""),
  );
  console.log(kleur.dim(`\nOpen ${adapter.displayName} in this folder to continue with full context.`));
}

function resolveSession(idOrPrefix?: string) {
  if (idOrPrefix) {
    const exact = getSession(idOrPrefix);
    if (exact) return exact;
    const rows = listSessions(500);
    const match = rows.find((r) => r.id.startsWith(idOrPrefix));
    if (match) return match;
    return undefined;
  }
  const rows = listSessions(1);
  return rows[0];
}
