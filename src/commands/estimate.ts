import { readFileSync } from "node:fs";
import kleur from "kleur";
import { estimateCost, formatUsd, listModels, type ModelId } from "../cost.js";

export type EstimateOptions = {
  file?: string;
  text?: string;
  model?: ModelId;
  expectedOutput?: number;
  all?: boolean;
};

export function estimateCommand(opts: EstimateOptions): void {
  const raw = opts.text ?? (opts.file ? readFileSync(opts.file, "utf8") : readStdinSync());
  if (!raw.trim()) throw new Error("No input. Use --file, --text, or pipe stdin.");

  const models: ModelId[] = opts.all ? listModels() : [opts.model ?? "claude-sonnet-4-5"];
  console.log(
    kleur.dim("model".padEnd(20)) +
      kleur.dim("input".padStart(10)) +
      kleur.dim("out~".padStart(10)) +
      kleur.dim("cost~".padStart(12)),
  );
  for (const m of models) {
    const e = estimateCost(raw, m, { expectedOutputTokens: opts.expectedOutput });
    const marker = e.isApproximate ? kleur.dim(" ~") : "  ";
    console.log(
      m.padEnd(20) +
        e.inputTokens.toLocaleString().padStart(10) +
        e.estimatedOutputTokens.toLocaleString().padStart(10) +
        formatUsd(e.totalCostUsd).padStart(12) +
        marker,
    );
  }
  if (models.some((m) => estimateCost("x", m).isApproximate)) {
    console.log(kleur.dim("\n~ Anthropic uses no public offline tokenizer; count is approximate (±10%)."));
  }
}

function readStdinSync(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}
