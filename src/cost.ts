import { encoding_for_model, get_encoding, type TiktokenModel } from "tiktoken";

export type Provider = "anthropic" | "openai";

export type ModelId =
  | "claude-opus-4-5"
  | "claude-sonnet-4-5"
  | "claude-haiku-4-5"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "o1"
  | "o1-mini";

type Price = { input: number; output: number };

// USD per 1M tokens. Update quarterly. Sources: provider pricing pages.
// Kept intentionally conservative — round up on input, down on output.
const PRICING: Record<ModelId, { provider: Provider; price: Price }> = {
  "claude-opus-4-5": { provider: "anthropic", price: { input: 15, output: 75 } },
  "claude-sonnet-4-5": { provider: "anthropic", price: { input: 3, output: 15 } },
  "claude-haiku-4-5": { provider: "anthropic", price: { input: 1, output: 5 } },
  "gpt-4o": { provider: "openai", price: { input: 2.5, output: 10 } },
  "gpt-4o-mini": { provider: "openai", price: { input: 0.15, output: 0.6 } },
  "o1": { provider: "openai", price: { input: 15, output: 60 } },
  "o1-mini": { provider: "openai", price: { input: 3, output: 12 } },
};

export function providerFor(model: ModelId): Provider {
  return PRICING[model].provider;
}

// Anthropic doesn't ship an official offline tokenizer; cl100k_base is close enough
// for cost estimation (typically within 5-10%). We flag it as an estimate, not truth.
function encoderFor(model: ModelId): { encode: (text: string) => Uint32Array; free: () => void } {
  const provider = providerFor(model);
  if (provider === "openai") {
    try {
      const enc = encoding_for_model(model as unknown as TiktokenModel);
      return { encode: (t) => enc.encode(t), free: () => enc.free() };
    } catch {
      const enc = get_encoding("cl100k_base");
      return { encode: (t) => enc.encode(t), free: () => enc.free() };
    }
  }
  const enc = get_encoding("cl100k_base");
  return { encode: (t) => enc.encode(t), free: () => enc.free() };
}

export function countTokens(text: string, model: ModelId): number {
  const enc = encoderFor(model);
  try {
    return enc.encode(text).length;
  } finally {
    enc.free();
  }
}

export type CostEstimate = {
  model: ModelId;
  provider: Provider;
  inputTokens: number;
  estimatedOutputTokens: number;
  inputCostUsd: number;
  estimatedOutputCostUsd: number;
  totalCostUsd: number;
  isApproximate: boolean;
};

export function estimateCost(
  text: string,
  model: ModelId,
  opts: { expectedOutputTokens?: number } = {},
): CostEstimate {
  const inputTokens = countTokens(text, model);
  // Default output guess: 25% of input, capped at 4000. Overridden by opts.
  const estimatedOutputTokens =
    opts.expectedOutputTokens ?? Math.min(4000, Math.round(inputTokens * 0.25));
  const { price, provider } = PRICING[model];
  const inputCostUsd = (inputTokens / 1_000_000) * price.input;
  const estimatedOutputCostUsd = (estimatedOutputTokens / 1_000_000) * price.output;
  return {
    model,
    provider,
    inputTokens,
    estimatedOutputTokens,
    inputCostUsd,
    estimatedOutputCostUsd,
    totalCostUsd: inputCostUsd + estimatedOutputCostUsd,
    isApproximate: provider === "anthropic",
  };
}

export function listModels(): ModelId[] {
  return Object.keys(PRICING) as ModelId[];
}

// Reference model for "$ saved" figures: avoided input tokens are priced at
// this model's input rate, since it's the default assumption used elsewhere
// (estimate_cost) for a typical daily-driver model. Approximate by design —
// same "honest numbers" framing as estimateCost's isApproximate flag.
const SAVINGS_REFERENCE_MODEL: ModelId = "claude-sonnet-4-5";

export function usdSavedForTokens(tokens: number, model: ModelId = SAVINGS_REFERENCE_MODEL): number {
  return (tokens / 1_000_000) * PRICING[model].price.input;
}

export function formatUsd(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
