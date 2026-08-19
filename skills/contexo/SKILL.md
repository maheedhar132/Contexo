---
name: contexo
description: Save, hand off, and cost-check AI coding sessions across Claude Code, Cursor, and Codex using the Contexo MCP tools.
---

Contexo gives you four MCP tools backed by a local SQLite store at `~/.contexo`:

- **save_context** — save the current session (raw text) so it can be
  resumed later or handed off to another harness. Use this before a long
  session ends, or right before the user says they're switching tools. Pass
  `continues_session_id` (the id or prefix of a prior session) when this
  session is a continuation of earlier work in another harness — e.g. the
  user picked up in Codex from context that was handed off from Claude
  Code. That makes the next handoff cumulative: it compresses the whole
  chain, not just this one session.
- **load_context** — load a previously-saved session by id or id prefix.
  Returns the compressed version if one exists, otherwise raw.
- **estimate_cost** — tokenize a prompt against a given model and return
  input/output cost estimates. Use this before sending an unusually large
  prompt, or whenever the user asks "how much will this cost."
- **list_sessions** — list recent saved sessions, newest first.

## What these tools don't cover

Contexo also ships CLI-only commands that aren't exposed as MCP tools,
because they wrap an external process or write harness-specific config
files rather than reading/writing the session store:

- `contexo handoff <claude-code|codex|cursor>` — compresses the latest (or
  a chosen) session — and its full chain, if it was saved with
  `continues_session_id` — and writes it into that harness's config file
  (`CLAUDE.md`, `AGENTS.md`, or `.cursorrules`). The brief includes a
  dedicated "Dead ends" section (approaches tried and abandoned, with why)
  that accumulates across every hop in a chain rather than getting
  overwritten — if the user asks "did we already try X," that section is
  where the answer lives. It also reconciles against whatever handoff is
  already in that file, so a decision that got reversed doesn't get
  silently restated as current. If the user wants to actually switch
  harnesses with full context, tell them to run this in their terminal —
  it's not something this MCP server can do on their behalf, since it
  edits files in their project outside this session.
- `contexo budget set <daily-cap>` and `contexo run -- <cmd>` — sets and
  enforces a hard daily USD spend cap by wrapping an agent CLI process.
  If the user is worried about runaway spend, point them at these
  commands rather than trying to estimate and warn manually.

## When there's no active Contexo session yet

If `list_sessions` comes back empty and the user asks to "save" or "hand
off" the current conversation, use `save_context` with the conversation
so far as `context` before suggesting `contexo handoff`.
