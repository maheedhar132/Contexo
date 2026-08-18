import { describe, expect, it } from "vitest";
import { buildCumulativeRawContext } from "./compress.js";

describe("buildCumulativeRawContext", () => {
  it("returns the raw context as-is for a single session", () => {
    const out = buildCumulativeRawContext([{ harness_source: "claude-code", raw_context: "hello" }]);
    expect(out).toBe("hello");
  });

  it("concatenates a chain oldest-to-newest with harness labels", () => {
    const out = buildCumulativeRawContext([
      { harness_source: "claude-code", raw_context: "did A" },
      { harness_source: "codex", raw_context: "did B" },
    ]);
    expect(out).toBe("--- from claude-code ---\ndid A\n\n--- from codex ---\ndid B");
  });

  it("labels a missing harness_source as unknown", () => {
    const out = buildCumulativeRawContext([
      { harness_source: null, raw_context: "x" },
      { harness_source: "cursor", raw_context: "y" },
    ]);
    expect(out).toContain("--- from unknown ---");
    expect(out).toContain("--- from cursor ---");
  });
});
