import { claudeCode } from "./claude-code.js";
import { codex } from "./codex.js";
import { cursor } from "./cursor.js";
import type { Adapter, HarnessId } from "./types.js";

export * from "./types.js";
export { claudeCode, codex, cursor };

export const ADAPTERS: Record<HarnessId, Adapter> = {
  "claude-code": claudeCode,
  codex,
  cursor,
};

export function getAdapter(id: HarnessId): Adapter {
  return ADAPTERS[id];
}

export function allAdapters(): Adapter[] {
  return Object.values(ADAPTERS);
}

export function detectHarnesses(cwd: string): Adapter[] {
  return allAdapters().filter((a) => a.detect(cwd));
}
