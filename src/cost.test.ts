import { describe, expect, it } from "vitest";
import { usdSavedForTokens, countTokens, estimateCost, isValidModel, type ModelId } from "./cost.js";

describe("usdSavedForTokens", () => {
  it("prices avoided tokens at the reference model's input rate", () => {
    expect(usdSavedForTokens(1_000_000)).toBeCloseTo(3, 5); // claude-sonnet-4-5 input: $3/1M
  });

  it("respects an explicit model override", () => {
    expect(usdSavedForTokens(1_000_000, "claude-haiku-4-5")).toBeCloseTo(1, 5);
  });

  it("returns 0 for 0 tokens saved", () => {
    expect(usdSavedForTokens(0)).toBe(0);
  });
});

describe("unknown model handling", () => {
  it("isValidModel rejects a bogus model id", () => {
    expect(isValidModel("bogus-model")).toBe(false);
    expect(isValidModel("claude-sonnet-4-5")).toBe(true);
  });

  it("countTokens throws a clear error for an unknown model instead of crashing on undefined pricing", () => {
    expect(() => countTokens("hello", "bogus-model" as ModelId)).toThrow(/Unknown model "bogus-model"/);
  });

  it("estimateCost throws a clear error for an unknown model", () => {
    expect(() => estimateCost("hello", "bogus-model" as ModelId)).toThrow(/Unknown model "bogus-model"/);
  });
});
