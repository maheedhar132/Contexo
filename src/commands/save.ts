import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import kleur from "kleur";
import { saveSession } from "../db.js";
import { countTokens, type ModelId } from "../cost.js";
import { detectHarnesses } from "../adapters/index.js";

export type SaveOptions = {
  name?: string;
  file?: string;
  text?: string;
  model?: ModelId;
  cwd?: string;
};

export async function saveCommand(opts: SaveOptions): Promise<{ id: string; tokens: number }> {
  const cwd = opts.cwd ?? process.cwd();
  const raw = resolveInput(opts);
  if (!raw.trim()) throw new Error("No context provided. Use --file <path>, --text <str>, or pipe stdin.");

  const model: ModelId = opts.model ?? "claude-sonnet-4-5";
  const tokens = countTokens(raw, model);
  const id = randomUUID();
  const name = opts.name ?? `session-${new Date().toISOString().slice(0, 16).replace("T", "-")}`;
  const detected = detectHarnesses(cwd)[0]?.id ?? null;

  saveSession({ id, name, harnessSource: detected, rawContext: raw, rawTokens: tokens });

  console.log(kleur.green("✓") + ` Saved session ${kleur.bold(id.slice(0, 8))} (${kleur.dim(name)})`);
  console.log(`  ${kleur.dim("tokens")}   ${tokens.toLocaleString()}`);
  if (detected) console.log(`  ${kleur.dim("source")}   ${detected}`);
  return { id, tokens };
}

function resolveInput(opts: SaveOptions): string {
  if (opts.text) return opts.text;
  if (opts.file) return readFileSync(opts.file, "utf8");
  return readStdinSync();
}

function readStdinSync(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}
