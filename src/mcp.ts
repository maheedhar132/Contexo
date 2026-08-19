import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getSession, listSessions, saveSession, setCompressed, getStatsSummary } from "./db.js";
import { countTokens, estimateCost, listModels, usdSavedForTokens, type ModelId } from "./cost.js";
import { VERSION } from "./version.js";
import { BRIEF_FORMAT } from "./compress.js";
import { getAdapter, wrapContexoBlock, type HarnessId } from "./adapters/index.js";

const SaveArgs = z.object({
  name: z.string().optional(),
  context: z.string().min(1),
  harness_source: z.string().optional(),
  model: z.string().optional(),
  continues_session_id: z.string().optional(),
  compressed_context: z.string().optional(),
});

const LoadArgs = z.object({ id: z.string().min(4) });

const EstimateArgs = z.object({
  text: z.string().min(1),
  model: z.string().optional(),
  expected_output_tokens: z.number().int().positive().optional(),
});

const ListArgs = z.object({ limit: z.number().int().positive().max(200).optional() });

const WriteHandoffArgs = z.object({
  target: z.enum(["claude-code", "codex", "cursor"]),
  body: z.string().min(1),
  session_id: z.string().optional(),
  cwd: z.string().optional(),
});

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: "contexo", version: VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "save_context",
        description:
          "Save the current AI session context to Contexo so it can be handed off to another harness later. Returns a session id. " +
          "You (the calling agent) already have model access — compress the context yourself and pass it as " +
          "compressed_context instead of relying on Contexo to call an LLM separately. Contexo only falls back to its " +
          "own Anthropic API call (requiring ANTHROPIC_API_KEY) when handoff happens outside any agent, e.g. a bare " +
          "terminal run of `contexo handoff`.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Human-readable label for the session" },
            context: { type: "string", description: "Full raw context to save" },
            harness_source: {
              type: "string",
              description: "Harness this context came from (e.g., claude-code, codex, cursor)",
            },
            model: {
              type: "string",
              description: "Model to use for token counting; defaults to claude-sonnet-4-5",
            },
            continues_session_id: {
              type: "string",
              description:
                "Id (or prefix) of a prior session this one continues, for cumulative cross-harness " +
                "handoff (e.g. picking up Codex work that itself continued from Claude Code). Omit for a " +
                "fresh, unrelated session.",
            },
            compressed_context: {
              type: "string",
              description:
                "Optional: your own compression of `context`, written in this exact format so it's " +
                "interchangeable with Contexo's own compression:\n\n" +
                BRIEF_FORMAT +
                "\n\nIf the target harness's config file (CLAUDE.md/AGENTS.md/.cursorrules) already has a " +
                "Contexo handoff block, read it yourself first and reconcile against it: carry Dead ends " +
                "forward always, and don't restate a superseded Decision as current. If you provide this, " +
                "Contexo stores it directly — no separate API call happens.",
            },
          },
          required: ["context"],
        },
      },
      {
        name: "load_context",
        description:
          "Load a previously-saved session by id (or id prefix). Returns compressed context if available, else raw.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
      {
        name: "estimate_cost",
        description:
          "Estimate the input+output token cost of sending a text to a model. Returns costs in USD.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string" },
            model: { type: "string", description: `One of: ${listModels().join(", ")}` },
            expected_output_tokens: { type: "number" },
          },
          required: ["text"],
        },
      },
      {
        name: "list_sessions",
        description:
          "List recent Contexo sessions, newest first. Also returns savings_summary: local, approximate " +
          "tokens/$ saved across every compressed session on this machine — use it if the user asks how much " +
          "Contexo has saved them.",
        inputSchema: {
          type: "object",
          properties: { limit: { type: "number", default: 20 } },
        },
      },
      {
        name: "write_handoff",
        description:
          "Write a handoff brief directly into another harness's config file (CLAUDE.md / AGENTS.md / .cursorrules) " +
          "— the whole point is doing this without Contexo ever calling an LLM. You compress and reconcile the brief " +
          "yourself (see save_context's compressed_context guidance for the format and diffing rules), then pass the " +
          "finished text here as `body` and Contexo just writes it. No ANTHROPIC_API_KEY involved anywhere in this path.",
        inputSchema: {
          type: "object",
          properties: {
            target: { type: "string", enum: ["claude-code", "codex", "cursor"], description: "Harness to hand off to" },
            body: { type: "string", description: "The finished, already-compressed handoff brief text to write" },
            session_id: {
              type: "string",
              description: "Session id (or prefix) this handoff represents; defaults to the most recent session",
            },
            cwd: { type: "string", description: "Project directory to write into; defaults to the server's cwd" },
          },
          required: ["target", "body"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    switch (req.params.name) {
      case "save_context": {
        const a = SaveArgs.parse(req.params.arguments);
        const model = (a.model ?? "claude-sonnet-4-5") as ModelId;

        let parentSessionId: string | null = null;
        if (a.continues_session_id) {
          const parent = resolveSessionByIdOrPrefix(a.continues_session_id);
          if (!parent) {
            return textResult({ error: `continues_session_id ${a.continues_session_id}: no matching session found` }, true);
          }
          parentSessionId = parent.id;
        }

        const id = randomUUID();
        const name = a.name ?? `mcp-session-${new Date().toISOString().slice(0, 16)}`;
        const tokens = countTokens(a.context, model);
        saveSession({
          id,
          name,
          harnessSource: a.harness_source ?? null,
          rawContext: a.context,
          rawTokens: tokens,
          parentSessionId,
        });

        let compressedTokens: number | null = null;
        if (a.compressed_context) {
          compressedTokens = countTokens(a.compressed_context, model);
          setCompressed(id, a.compressed_context, compressedTokens);
        }

        return textResult({ id, name, tokens, continues: parentSessionId, compressed_tokens: compressedTokens });
      }
      case "load_context": {
        const a = LoadArgs.parse(req.params.arguments);
        const s = resolveSessionByIdOrPrefix(a.id);
        if (!s) return textResult({ error: `session ${a.id} not found` }, true);
        return textResult({
          id: s.id,
          name: s.name,
          harness_source: s.harness_source,
          raw_tokens: s.raw_tokens,
          compressed_tokens: s.compressed_tokens,
          context: s.compressed_context ?? s.raw_context,
          compressed: Boolean(s.compressed_context),
        });
      }
      case "estimate_cost": {
        const a = EstimateArgs.parse(req.params.arguments);
        const model = (a.model ?? "claude-sonnet-4-5") as ModelId;
        const e = estimateCost(a.text, model, { expectedOutputTokens: a.expected_output_tokens });
        return textResult(e);
      }
      case "list_sessions": {
        const a = ListArgs.parse(req.params.arguments ?? {});
        const rows = listSessions(a.limit ?? 20).map((r) => ({
          id: r.id,
          name: r.name,
          harness_source: r.harness_source,
          raw_tokens: r.raw_tokens,
          compressed_tokens: r.compressed_tokens,
          updated_at: r.updated_at,
        }));
        const summary = getStatsSummary();
        return textResult({
          sessions: rows,
          savings_summary: {
            sessions_compressed: summary.sessionsCompressed,
            tokens_saved: summary.tokensSaved,
            usd_saved_approx: usdSavedForTokens(summary.tokensSaved),
          },
        });
      }
      case "write_handoff": {
        const a = WriteHandoffArgs.parse(req.params.arguments);
        const session = a.session_id ? resolveSessionByIdOrPrefix(a.session_id) : listSessions(1)[0];
        if (!session) return textResult({ error: "No session found. Call save_context first." }, true);

        const adapter = getAdapter(a.target as HarnessId);
        const cwd = a.cwd ?? process.cwd();
        const block = wrapContexoBlock(a.body, session.id, session.harness_source);
        const writtenTo = adapter.writeContexoBlock(cwd, block);
        return textResult({ written_to: writtenTo, target: a.target, session_id: session.id });
      }
      default:
        return textResult({ error: `unknown tool ${req.params.name}` }, true);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function resolveSessionByIdOrPrefix(idOrPrefix: string) {
  const exact = getSession(idOrPrefix);
  if (exact) return exact;
  return listSessions(500).find((r) => r.id.startsWith(idOrPrefix));
}

function textResult(payload: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    isError,
  };
}
