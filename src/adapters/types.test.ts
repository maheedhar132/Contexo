import { describe, expect, it } from "vitest";
import { wrapContexoBlock, replaceContexoBlock, extractContexoBlockBody } from "./types.js";

describe("extractContexoBlockBody", () => {
  it("returns null when there's no block", () => {
    expect(extractContexoBlockBody("just some markdown")).toBeNull();
  });

  it("extracts the body, stripping the header line", () => {
    const block = wrapContexoBlock("# Task\nDo the thing.", "abc123", "claude-code");
    const body = extractContexoBlockBody(block);
    expect(body).toBe("# Task\nDo the thing.");
  });

  it("round-trips through replaceContexoBlock", () => {
    const first = wrapContexoBlock("first brief", "id1", "claude-code");
    const doc = replaceContexoBlock("# My Project\n\nSome notes.", first);
    expect(extractContexoBlockBody(doc)).toBe("first brief");

    const second = wrapContexoBlock("second brief", "id2", "codex");
    const updated = replaceContexoBlock(doc, second);
    expect(extractContexoBlockBody(updated)).toBe("second brief");
    expect(updated).toContain("# My Project");
  });
});
