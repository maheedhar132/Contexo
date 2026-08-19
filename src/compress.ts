import Anthropic from "@anthropic-ai/sdk";

// Exported so tests can guard against regressing a section header without
// hitting the Anthropic API.
export const COMPRESSION_PROMPT = `You are compressing an AI-coding session (possibly spanning multiple harnesses/tools in sequence) so another AI harness can pick up work with zero re-onboarding.

Produce a Markdown document with EXACTLY these sections, in this order. Omit any that would be empty.

# Task
One paragraph. What the user is trying to accomplish, in their own words if possible.

# Decisions
Bulleted. Each = a concrete decision currently in force (technology, naming, approach). No provisional talk.

# Changes so far
Bulleted list of files created/modified with a one-line "why" per file, across the whole session.

# Dead ends
Bulleted. Each = an approach that was tried and abandoned or rejected, with
a one-line reason why. This is the single most important section for
saving the next agent's time — its whole purpose is stopping the next
agent from re-attempting something already ruled out and walking straight
back into the same dead end. Only include things the raw context actually
shows were tried and abandoned — do not infer a dead end from a decision
that was simply made without an alternative being attempted first.

# Open questions
Bulleted. Only questions the next agent must resolve to proceed. Do not invent questions.

# Next step
A single, unambiguous next action the new session should take.

Rules:
- Never invent facts. If unsure, say "unclear from context".
- No preamble, no closing remarks, no meta commentary.
- Assume the reader has zero prior context but is a competent engineer.
- Target 400-800 tokens output. Prefer terse over verbose.
- If the input spans multiple harness hops (marked with "--- from <harness> ---" separators), treat it as one continuous session — later hops take precedence over earlier ones when they conflict, EXCEPT Dead ends: those accumulate across every hop and are never dropped just because a later hop doesn't re-mention them. A dead end stays a dead end regardless of which harness discovered it.`;

export const DIFF_ADDENDUM = `
You are ALSO given the PREVIOUS handoff brief that's currently written into the target file (below, inside <previous_brief>). Do not silently drop or restate anything from it unchanged — reconcile it against the new session content:
- If a previous Decision or Change no longer holds given the new session content, do not carry it forward as if still true. Either omit it or, if it's directly relevant to avoiding a repeated mistake, note it under Decisions as superseded (e.g. "~~Use X~~ — replaced with Y").
- Dead ends are the one section that is cumulative, not reconciled: carry every dead end from the previous brief forward even if the new session content doesn't mention it again, and add any new ones the new content reveals. Never let a previously-identified dead end silently disappear — that's exactly the failure mode this section exists to prevent.
- If nothing in the previous brief changed for a section, it's fine for that section to stay the same.
- Never present a superseded fact as current.`;

export type CompressResult = {
  compressed: string;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
};

export async function compressContext(
  rawContext: string,
  apiKey?: string,
  previousBrief?: string | null,
): Promise<CompressResult> {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "Compression requires ANTHROPIC_API_KEY. Set it in your environment, or pass --api-key.\n" +
        "Contexo Pro will remove this requirement — compression runs on our servers.",
    );
  }

  const client = new Anthropic({ apiKey: key });
  const model = "claude-haiku-4-5";
  const system = previousBrief ? COMPRESSION_PROMPT + "\n" + DIFF_ADDENDUM : COMPRESSION_PROMPT;
  const userContent = previousBrief
    ? `<previous_brief>\n${previousBrief}\n</previous_brief>\n\nCompress this session:\n\n<session>\n${rawContext}\n</session>`
    : `Compress this session:\n\n<session>\n${rawContext}\n</session>`;

  const response = await client.messages.create({
    model,
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: userContent }],
  });

  const compressed = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim();

  return {
    compressed,
    modelUsed: model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// Builds one cumulative raw-context string from a session lineage
// (oldest -> newest), so a chained handoff (Claude Code -> Codex -> Cursor)
// compresses everything that happened, not just the latest hop.
export function buildCumulativeRawContext(
  chain: { harness_source: string | null; raw_context: string }[],
): string {
  if (chain.length === 1) return chain[0]!.raw_context;
  return chain
    .map((s) => `--- from ${s.harness_source ?? "unknown"} ---\n${s.raw_context}`)
    .join("\n\n");
}
