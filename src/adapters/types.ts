export type HarnessId = "claude-code" | "codex" | "cursor";

export type Adapter = {
  id: HarnessId;
  displayName: string;
  configFileName: string;
  detect(cwd: string): boolean;
  read(cwd: string): string | null;
  writeContexoBlock(cwd: string, block: string): string;
};

export const CONTEXO_BLOCK_START = "<!-- contexo:context:start -->";
export const CONTEXO_BLOCK_END = "<!-- contexo:context:end -->";

export function wrapContexoBlock(body: string, sessionId: string, sourceHarness: string | null): string {
  const header = `> Contexo context handoff — session \`${sessionId}\`${
    sourceHarness ? ` from \`${sourceHarness}\`` : ""
  }. Do not edit inside the markers; regenerate with \`contexo handoff\`.`;
  return `${CONTEXO_BLOCK_START}\n${header}\n\n${body.trim()}\n${CONTEXO_BLOCK_END}`;
}

// Pulls the body out of a previously-written handoff block (stripping the
// header line), so a new handoff can be diffed against it instead of
// silently overwriting it blind. Returns null if there's no existing block.
export function extractContexoBlockBody(existing: string): string | null {
  const startIdx = existing.indexOf(CONTEXO_BLOCK_START);
  const endIdx = existing.indexOf(CONTEXO_BLOCK_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return null;
  const inner = existing.slice(startIdx + CONTEXO_BLOCK_START.length, endIdx).trim();
  const withoutHeader = inner.replace(/^>.*\n\n?/, "").trim();
  return withoutHeader.length > 0 ? withoutHeader : null;
}

export function replaceContexoBlock(existing: string, block: string): string {
  const startIdx = existing.indexOf(CONTEXO_BLOCK_START);
  const endIdx = existing.indexOf(CONTEXO_BLOCK_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return existing.trim() + (existing.trim() ? "\n\n" : "") + block + "\n";
  }
  const before = existing.slice(0, startIdx).replace(/\s+$/, "");
  const after = existing.slice(endIdx + CONTEXO_BLOCK_END.length).replace(/^\s+/, "");
  const parts = [before, block, after].filter((p) => p.length > 0);
  return parts.join("\n\n") + "\n";
}
