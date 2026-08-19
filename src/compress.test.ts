import { describe, expect, it } from "vitest";
import { buildCumulativeRawContext, COMPRESSION_PROMPT, DIFF_ADDENDUM } from "./compress.js";

describe("compression prompt", () => {
  it("includes a Dead ends section between Changes and Open questions", () => {
    const changesIdx = COMPRESSION_PROMPT.indexOf("# Changes so far");
    const deadEndsIdx = COMPRESSION_PROMPT.indexOf("# Dead ends");
    const openQuestionsIdx = COMPRESSION_PROMPT.indexOf("# Open questions");
    expect(changesIdx).toBeGreaterThan(-1);
    expect(deadEndsIdx).toBeGreaterThan(changesIdx);
    expect(openQuestionsIdx).toBeGreaterThan(deadEndsIdx);
  });

  it("instructs that dead ends accumulate across harness hops instead of being overwritten", () => {
    expect(COMPRESSION_PROMPT).toMatch(/Dead ends:? .*accumulate across every hop/);
  });

  it("the diff addendum instructs dead ends are cumulative, not reconciled away", () => {
    expect(DIFF_ADDENDUM).toMatch(/Dead ends are the one section that is cumulative/);
  });
});

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
