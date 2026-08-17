# Portal

**Portable AI context and cost control across every AI coding harness.**

Stop paying twice. Portal saves your work in one harness (Claude Code, Codex, Cursor…) and hands it off to another in a single command — compressed, so the new session starts from the right place at near-zero token cost.

> **Note.** The package is published to npm as [`portalctx`](https://www.npmjs.com/package/portalctx) because `portal` is taken. The CLI binary is still `portal`.

## Install

```bash
npm i -g portalctx
# or, one-off
npx portalctx --help
```

## 30-second tour

```bash
# 1. Save the current session (paste a transcript or point at a file)
portal save --file ./chat.md --name "auth refactor"

# 2. See what you've got
portal sessions

# 3. Hand off to another harness — compressed, ready to resume
portal handoff cursor

# 4. Know the cost before you fire
echo "Refactor this file to use zod" | portal estimate --all

# 5. Cap your daily spend and let Portal enforce it
portal budget set 5.00
portal run -- claude "fix the failing tests"
```

## What Portal actually does

- **Cross-harness handoff.** Save a session in one harness, resume in another with a compressed context that captures decisions, changes so far, and the next step. No re-explaining.
- **Cost preflight.** `portal estimate` tokenizes your prompt against every supported model and shows what a run will cost *before* you send it.
- **Hard budget cap.** `portal run` wraps your agent, watches spend in real time, and terminates the process at your daily cap. No more $200 surprises.
- **Works with your existing tools.** Ships as an MCP server (Claude Code, Cursor, Cline, Windsurf) and as a config-file injector (Codex `AGENTS.md`, Claude `CLAUDE.md`, Cursor `.cursorrules`).
- **Runs 100% offline in the free tier.** SQLite on your machine. No account required.

## Architecture

```
┌───────────────────────────────────────────────────────┐
│ Claude Code   Codex CLI   Cursor    (Cline/Windsurf) │
└──────┬────────────┬──────────┬────────────────────────┘
       │ MCP        │ AGENTS.md│ MCP + .cursorrules
       ▼            ▼          ▼
   ┌──────────────────────────────────────────────┐
   │  Portal CLI + MCP server (Node/TypeScript)   │  ← this repo (Apache 2.0)
   │  • local SQLite session store                │
   │  • tokenizers + cost table                   │
   │  • harness adapters                          │
   │  • local compression (your API key)          │
   └──────────────────┬───────────────────────────┘
                      │ HTTPS (Pro tier, optional)
                      ▼
   ┌──────────────────────────────────────────────┐
   │  Portal Cloud (closed, coming soon)          │
   │  • compression-as-a-service                  │
   │  • learned cost prediction                   │
   │  • cross-machine sync                        │
   │  • team dashboards                           │
   └──────────────────────────────────────────────┘
```

## Wire Portal into Claude Code

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "portal": { "command": "portal", "args": ["mcp"] }
  }
}
```

Claude Code now sees four tools: `save_context`, `load_context`, `estimate_cost`, `list_sessions`.

## Wire Portal into Cursor

Cursor supports MCP the same way. In `~/.cursor/mcp.json`:

```json
{ "mcpServers": { "portal": { "command": "portal", "args": ["mcp"] } } }
```

## Wire Portal into Codex

Codex reads `AGENTS.md`. Run:

```bash
portal handoff codex
```

Portal writes a `<!-- portal:context:start -->` block into your project's `AGENTS.md`. Codex picks it up automatically. Re-running `handoff` replaces the block cleanly.

## Cost estimation — honest numbers

- OpenAI models use `tiktoken` (exact).
- Anthropic models use `cl100k_base` as a proxy (typically ±5–10%). We flag those results with `~`.

Update the pricing table in [`src/cost.ts`](src/cost.ts) as providers change prices.

## Compression, honestly

Portal's compression sends your raw context to Anthropic Haiku with a fixed system prompt (see [`src/compress.ts`](src/compress.ts)). Cost is roughly **$0.001 per compression** on typical sessions.

The free tier uses **your** `ANTHROPIC_API_KEY`. Portal Pro will move compression to our servers (better prompt, no key required, and no per-compression cost on your end).

**We do not claim "zero token" handoffs.** Loading context into a new session always costs input tokens. What you get:

- ~90–95% smaller payload than replaying full history.
- Cache-friendly single block (Anthropic prompt caching gives 90% discount on reuse within TTL).
- Zero re-onboarding cost — the new agent doesn't have to ask 20 clarifying questions.

## Pricing (planned)

| Tier | Price | Contents |
|---|---|---|
| **Free** (this repo) | $0 | Local everything: save/load, MCP server, adapters, budget cap, cost estimator, compression via your API key |
| **Pro** | $9/mo | Cloud sync across machines (E2E encrypted), compression-as-a-service, learned cost model, budget alerts, session search |
| **Team** | $29/user/mo | Shared team context, team-wide budgets, dashboards, SSO |
| **Enterprise** | from $2K/mo | Self-hosted, SOC 2 path, SIEM exports (Dynatrace/Datadog/Splunk), custom skill packs |

## Development

```bash
git clone <this repo>
npm install
npm run build
node dist/cli.js --help
```

Run tests: `npm test`. Type-check: `npm run typecheck`.

## License

Apache 2.0 — see [LICENSE](./LICENSE).

## Trademark

"Portal" and the Portal logo are pending trademarks of the project maintainer. Forks and derivative works are welcome under the Apache 2.0 license, but must not use the "Portal" name or logo to identify themselves. See [TRADEMARK.md](./TRADEMARK.md).
