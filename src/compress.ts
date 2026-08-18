import Anthropic from "@anthropic-ai/sdk";

const COMPRESSION_PROMPT = `You are compressing a long AI-coding session so another AI harness can pick up work with zero re-onboarding.

Produce a Markdown document with EXACTLY these sections, in this order. Omit any that would be empty.

# Task
One paragraph. What the user is trying to accomplish, in their own words if possible.

# Decisions
Bulleted. Each = a concrete decision already made (technology, naming, approach). No provisional talk.

# Changes so far
Bulleted list of files created/modified with a one-line "why" per file.

# Open questions
Bulleted. Only questions the next agent must resolve to proceed. Do not invent questions.

# Next step
A single, unambiguous next action the new session should take.

Rules:
- Never invent facts. If unsure, say "unclear from context".
- No preamble, no closing remarks, no meta commentary.
- Assume the reader has zero prior context but is a competent engineer.
- Target 400-800 tokens output. Prefer terse over verbose.`;

export type CompressResult = {
  compressed: string;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
};

export async function compressContext(rawContext: string, apiKey?: string): Promise<CompressResult> {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "Compression requires ANTHROPIC_API_KEY. Set it in your environment, or pass --api-key.\n" +
        "Contexo Pro will remove this requirement — compression runs on our servers.",
    );
  }

  const client = new Anthropic({ apiKey: key });
  const model = "claude-haiku-4-5";
  const response = await client.messages.create({
    model,
    max_tokens: 1500,
    system: COMPRESSION_PROMPT,
    messages: [
      {
        role: "user",
        content: `Compress this session:\n\n<session>\n${rawContext}\n</session>`,
      },
    ],
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
