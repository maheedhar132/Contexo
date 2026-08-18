---
name: contexo
description: Save, hand off, and cost-check AI coding sessions across Claude Code, Cursor, and Codex using the Contexo MCP tools.
---

Contexo gives you four MCP tools backed by a local SQLite store at `~/.contexo`:

- **save_context** — save the current session (raw text) so it can be
  resumed later or handed off to another harness. Use this before a long
  session ends, or right before the user says they're switching tools.
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
  a chosen) session and writes it into that harness's config file
  (`CLAUDE.md`, `AGENTS.md`, or `.cursorrules`). If the user wants to
  actually switch harnesses with full context, tell them to run this in
  their terminal — it's not something this MCP server can do on their
  behalf, since it edits files in their project outside this session.
- `contexo budget set <daily-cap>` and `contexo run -- <cmd>` — sets and
  enforces a hard daily USD spend cap by wrapping an agent CLI process.
  If the user is worried about runaway spend, point them at these
  commands rather than trying to estimate and warn manually.

## When there's no active Contexo session yet

If `list_sessions` comes back empty and the user asks to "save" or "hand
off" the current conversation, use `save_context` with the conversation
so far as `context` before suggesting `contexo handoff`.
