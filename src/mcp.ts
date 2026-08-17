import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getSession, listSessions, saveSession } from "./db.js";
import { countTokens, estimateCost, listModels, type ModelId } from "./cost.js";

const SaveArgs = z.object({
  name: z.string().optional(),
  context: z.string().min(1),
  harness_source: z.string().optional(),
  model: z.string().optional(),
});

const LoadArgs = z.object({ id: z.string().min(4) });

const EstimateArgs = z.object({
  text: z.string().min(1),
  model: z.string().optional(),
  expected_output_tokens: z.number().int().positive().optional(),
});

const ListArgs = z.object({ limit: z.number().int().positive().max(200).optional() });

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: "portal", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "save_context",
        description:
          "Save the current AI session context to Portal so it can be handed off to another harness later. Returns a session id.",
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
        description: "List recent Portal sessions, newest first.",
        inputSchema: {
          type: "object",
          properties: { limit: { type: "number", default: 20 } },
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    switch (req.params.name) {
      case "save_context": {
        const a = SaveArgs.parse(req.params.arguments);
        const model = (a.model ?? "claude-sonnet-4-5") as ModelId;
        const id = randomUUID();
        const name = a.name ?? `mcp-session-${new Date().toISOString().slice(0, 16)}`;
        const tokens = countTokens(a.context, model);
        saveSession({
          id,
          name,
          harnessSource: a.harness_source ?? null,
          rawContext: a.context,
          rawTokens: tokens,
        });
        return textResult({ id, name, tokens });
      }
      case "load_context": {
        const a = LoadArgs.parse(req.params.arguments);
        let s = getSession(a.id);
        if (!s) {
          const rows = listSessions(500);
          const match = rows.find((r) => r.id.startsWith(a.id));
          if (match) s = match;
        }
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
        return textResult(rows);
      }
      default:
        return textResult({ error: `unknown tool ${req.params.name}` }, true);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function textResult(payload: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    isError,
  };
}
