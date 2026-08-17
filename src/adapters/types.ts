export type HarnessId = "claude-code" | "codex" | "cursor";

export type Adapter = {
  id: HarnessId;
  displayName: string;
  configFileName: string;
  detect(cwd: string): boolean;
  read(cwd: string): string | null;
  writePortalBlock(cwd: string, block: string): string;
};

export const PORTAL_BLOCK_START = "<!-- portal:context:start -->";
export const PORTAL_BLOCK_END = "<!-- portal:context:end -->";

export function wrapPortalBlock(body: string, sessionId: string, sourceHarness: string | null): string {
  const header = `> Portal context handoff — session \`${sessionId}\`${
    sourceHarness ? ` from \`${sourceHarness}\`` : ""
  }. Do not edit inside the markers; regenerate with \`portal handoff\`.`;
  return `${PORTAL_BLOCK_START}\n${header}\n\n${body.trim()}\n${PORTAL_BLOCK_END}`;
}

export function replacePortalBlock(existing: string, block: string): string {
  const startIdx = existing.indexOf(PORTAL_BLOCK_START);
  const endIdx = existing.indexOf(PORTAL_BLOCK_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return existing.trim() + (existing.trim() ? "\n\n" : "") + block + "\n";
  }
  const before = existing.slice(0, startIdx).replace(/\s+$/, "");
  const after = existing.slice(endIdx + PORTAL_BLOCK_END.length).replace(/^\s+/, "");
  const parts = [before, block, after].filter((p) => p.length > 0);
  return parts.join("\n\n") + "\n";
}
