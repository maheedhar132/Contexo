# Contexo

**Portable AI context and cost control across every AI coding harness.**

Stop paying twice. Contexo saves your work in one harness (Claude Code, Codex, Cursor…) and hands it off to another in a single command — compressed, so the new session starts from the right place at near-zero token cost.

## Install

```bash
npm i -g contexo
# or, one-off
npx contexo --help
```

## 30-second tour

```bash
# 1. Save the current session (paste a transcript or point at a file)
contexo save --file ./chat.md --name "auth refactor"

# 2. See what you've got
contexo sessions

# 3. Hand off to another harness — compressed, ready to resume
contexo handoff cursor

# 4. Know the cost before you fire
echo "Refactor this file to use zod" | contexo estimate --all

# 5. Cap your daily spend and let Contexo enforce it
contexo budget set 5.00
contexo run -- claude "fix the failing tests"
```

## What Contexo actually does

- **Cross-harness handoff.** Save a session in one harness, resume in another with a compressed context that captures decisions, changes so far, and the next step. No re-explaining.
- **Cumulative, diff-aware handoffs.** Chain sessions across a whole journey with `contexo save --continues <id>` — Claude Code → Codex → Cursor — and `handoff` compresses the *entire* chain, not just the latest hop. It also reads whatever handoff is already sitting in the target file and reconciles against it, so a decision you reversed three hops ago doesn't get confidently restated as current.
- **Dead ends carry forward.** The brief has a dedicated section for approaches that were tried and abandoned, with why — the single biggest source of wasted agent time is re-attempting something already ruled out. Unlike Decisions, Dead ends accumulate across every hop in a chain instead of being overwritten.
- **Cost preflight.** `contexo estimate` tokenizes your prompt against every supported model and shows what a run will cost *before* you send it.
- **Hard budget cap.** `contexo run` wraps your agent, watches spend in real time, and terminates the process at your daily cap. No more $200 surprises.
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
   │  Contexo CLI + MCP server (Node/TypeScript)  │  ← this repo (Apache 2.0)
   │  • local SQLite session store                │
   │  • tokenizers + cost table                   │
   │  • harness adapters                          │
   │  • local compression (your API key)          │
   └──────────────────┬───────────────────────────┘
                      │ HTTPS (Pro tier, optional)
                      ▼
   ┌──────────────────────────────────────────────┐
   │  Contexo Cloud (closed, coming soon)         │
   │  • compression-as-a-service                  │
   │  • learned cost prediction                   │
   │  • cross-machine sync                        │
   │  • team dashboards                           │
   └──────────────────────────────────────────────┘
```

## Install as a plugin — no `npm install` required

Contexo ships as a plugin, not just an npm package. The MCP server launches
via `npx`, so a harness's own plugin manager can pull and run it on demand —
you never have to `npm i -g` anything yourself.

**Claude Code** (uses its own plugin/marketplace format, `.claude-plugin/`):

```
/plugin marketplace add maheedhar132/Contexo
/plugin install contexo
```

**Codex, Cursor, GitHub Copilot, VS Code, Kiro, ChatGPT** (via the
cross-vendor [Agent Plugins 1.0](https://github.com/agentplugins/agent-plugins-spec)
standard — `plugin.json` + `mcp.json` + `skills/` at the repo root): add
this repo as a plugin source in whichever of those clients you use; each
reads the same manifest.

Either path gives the agent four tools (`save_context`, `load_context`,
`estimate_cost`, `list_sessions`) plus a `contexo` skill describing when to
use them and when to fall back to the CLI-only commands (`handoff`,
`budget`, `run`) that can't run as MCP tools since they write files or wrap
external processes.

## Wire Contexo into Claude Code manually

If you'd rather configure the MCP server by hand instead of installing the
plugin, add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "contexo": { "command": "npx", "args": ["-y", "@maheedhar132/contexo", "mcp"] }
  }
}
```

(Already have it installed globally? `{ "command": "contexo", "args": ["mcp"] }` works too.)

Claude Code now sees four tools: `save_context`, `load_context`, `estimate_cost`, `list_sessions`.

## Wire Contexo into Cursor manually

Cursor supports MCP the same way. In `~/.cursor/mcp.json`:

```json
{ "mcpServers": { "contexo": { "command": "npx", "args": ["-y", "@maheedhar132/contexo", "mcp"] } } }
```

## Wire Contexo into Codex

Codex reads `AGENTS.md`. Run:

```bash
npx -y @maheedhar132/contexo handoff codex
```

Contexo writes a `<!-- contexo:context:start -->` block into your project's `AGENTS.md`. Codex picks it up automatically. Re-running `handoff` replaces the block cleanly.

## Cost estimation — honest numbers

- OpenAI models use `tiktoken` (exact).
- Anthropic models use `cl100k_base` as a proxy (typically ±5–10%). We flag those results with `~`.

Update the pricing table in [`src/cost.ts`](src/cost.ts) as providers change prices.

## Compression, honestly

Contexo's compression sends your raw context to Anthropic Haiku with a fixed system prompt (see [`src/compress.ts`](src/compress.ts)). Cost is roughly **$0.001 per compression** on typical sessions.

The free tier uses **your** `ANTHROPIC_API_KEY`. Contexo Pro will move compression to our servers (better prompt, no key required, and no per-compression cost on your end).

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

"Contexo" and the Contexo logo are pending trademarks of the project maintainer. Forks and derivative works are welcome under the Apache 2.0 license, but must not use the "Contexo" name or logo to identify themselves. See [TRADEMARK.md](./TRADEMARK.md).
