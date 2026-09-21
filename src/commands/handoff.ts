import kleur from "kleur";
import { resolveSession, listSessions, setCompressed, getSessionChain } from "../db.js";
import { getAdapter, wrapContexoBlock, extractContexoBlockBody, type HarnessId } from "../adapters/index.js";
import { compressContext, buildCumulativeRawContext } from "../compress.js";
import { countTokens, formatUsd, usdSavedForTokens, type ModelId } from "../cost.js";

export type HandoffOptions = {
  session?: string;
  cwd?: string;
  apiKey?: string;
  skipCompression?: boolean;
};

export async function handoffCommand(target: HarnessId, opts: HandoffOptions = {}): Promise<void> {
  const cwd = opts.cwd ?? process.cwd();
  const sessionRow = resolveHandoffSession(opts.session);
  if (!sessionRow) {
    const msg = opts.session
      ? `Session ${opts.session} not found.`
      : "No session found. Save one first: contexo save --file <path>";
    console.log(kleur.red(msg));
    process.exitCode = 1;
    return;
  }

  const chain = getSessionChain(sessionRow.id);
  const cumulative = chain.length > 1;
  const rawTokensTotal = chain.reduce((sum, s) => sum + s.raw_tokens, 0);

  const adapter = getAdapter(target);
  const existingTargetContent = adapter.read(cwd);
  const previousBrief = existingTargetContent ? extractContexoBlockBody(existingTargetContent) : null;

  let body = opts.skipCompression ? null : sessionRow.compressed_context;
  // A previously-compressed single-session cache can't be reused once this
  // handoff needs to be cumulative or diffed against a previous brief — both
  // require a fresh compression call over the full chain.
  if (body && (cumulative || previousBrief)) body = null;
  let compressedTokens = opts.skipCompression ? rawTokensTotal : sessionRow.compressed_tokens ?? 0;

  if (!body && !opts.skipCompression) {
    const rawInput = cumulative ? buildCumulativeRawContext(chain) : sessionRow.raw_context;
    const label = [cumulative && `${chain.length} chained sessions`, previousBrief && "diffing against existing handoff"]
      .filter(Boolean)
      .join(", ");
    console.log(
      kleur.dim(`Compressing${label ? ` (${label})` : ""} (using your ANTHROPIC_API_KEY, ~$0.001 per compression)...`),
    );
    try {
      const result = await compressContext(rawInput, opts.apiKey, previousBrief);
      body = result.compressed;
      compressedTokens = countTokens(body, "claude-sonnet-4-5" as ModelId);
      // Only cache on the leaf session, and only when it's a plain
      // single-session compression — a cumulative/diffed result is specific
      // to this handoff's target and previous state, not reusable as-is.
      if (!cumulative && !previousBrief) setCompressed(sessionRow.id, body, compressedTokens);
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
      body = cumulative ? buildCumulativeRawContext(chain) : sessionRow.raw_context;
      compressedTokens = rawTokensTotal;
    }
  }

  const fallbackRaw = cumulative ? buildCumulativeRawContext(chain) : sessionRow.raw_context;
  const block = wrapContexoBlock(body ?? fallbackRaw, sessionRow.id, sessionRow.harness_source);
  const writtenTo = adapter.writeContexoBlock(cwd, block);

  console.log(
    kleur.green("✓") +
      ` Handoff ready: ${kleur.bold(adapter.displayName)}` +
      kleur.dim(` (${writtenTo})`),
  );
  if (cumulative) {
    console.log(kleur.dim(`  cumulative across ${chain.length} sessions: ${chain.map((s) => s.harness_source ?? "?").join(" → ")}`));
  }
  if (previousBrief) {
    console.log(kleur.dim("  diffed against the existing handoff already in this file"));
  }
  // Positive = shrank (the expected case); negative = the brief ended up
  // longer than the raw save (e.g. a short save with a verbose template).
  const savedPct =
    rawTokensTotal > 0 && compressedTokens > 0 ? ((rawTokensTotal - compressedTokens) / rawTokensTotal) * 100 : null;
  const pctLabel =
    savedPct === null
      ? ""
      : savedPct >= 0
        ? kleur.green(`  (-${savedPct.toFixed(1)}%)`)
        : kleur.yellow(`  (+${Math.abs(savedPct).toFixed(1)}% larger)`);
  console.log(
    `  ${kleur.dim("raw")}         ${rawTokensTotal.toLocaleString()} tokens\n` +
      `  ${kleur.dim("handoff")}     ${compressedTokens.toLocaleString()} tokens` +
      pctLabel,
  );
  if (rawTokensTotal > compressedTokens) {
    const usdSaved = usdSavedForTokens(rawTokensTotal - compressedTokens);
    console.log(
      kleur.dim(
        `  Saved ~${(rawTokensTotal - compressedTokens).toLocaleString()} tokens (~${formatUsd(usdSaved)}) vs. replaying full history.`,
      ),
    );
  }
  console.log(kleur.dim(`\nOpen ${adapter.displayName} in this folder to continue with full context.`));
}

function resolveHandoffSession(idOrPrefix?: string) {
  if (idOrPrefix) return resolveSession(idOrPrefix);
  return listSessions(1)[0];
}
