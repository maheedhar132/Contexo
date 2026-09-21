import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { estimateCommand } from "./estimate.js";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("estimateCommand", () => {
  it("prints one row for the default model", () => {
    estimateCommand({ text: "hello world" });
    const printed = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join("\n");
    expect(printed).toContain("claude-sonnet-4-5");
  });

  it("prints a row per model with --all", () => {
    estimateCommand({ text: "hello world", all: true });
    const printed = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join("\n");
    expect(printed).toContain("claude-opus-4-5");
    expect(printed).toContain("gpt-4o");
    expect(printed).toContain("o1-mini");
  });

  it("respects an explicit expectedOutput", () => {
    estimateCommand({ text: "x", expectedOutput: 500 });
    const printed = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join("\n");
    expect(printed).toContain("500");
  });

  it("throws on empty/whitespace-only input", () => {
    expect(() => estimateCommand({ text: "   " })).toThrow(/No input/);
  });

  it("propagates the unknown-model error from cost.ts instead of crashing silently", () => {
    expect(() => estimateCommand({ text: "hi", model: "bogus-model" as never })).toThrow(/Unknown model/);
  });
});
