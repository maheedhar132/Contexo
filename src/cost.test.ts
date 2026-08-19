import { describe, expect, it } from "vitest";
import { usdSavedForTokens } from "./cost.js";

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
