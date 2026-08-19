---
name: contexo
description: Save, hand off, and cost-check AI coding sessions across Claude Code, Cursor, and Codex using the Contexo MCP tools.
---

Contexo gives you five MCP tools backed by a local SQLite store at `~/.contexo`:

- **save_context** — save the current session (raw text) so it can be
  resumed later or handed off to another harness. Use this before a long
  session ends, or right before the user says they're switching tools.
  - Pass `continues_session_id` (the id or prefix of a prior session) when
    this session is a continuation of earlier work in another harness —
    e.g. the user picked up in Codex from context that was handed off from
    Claude Code. That makes the next handoff cumulative: it covers the
    whole chain, not just this one session.
  - Pass `compressed_context` with your own compression of `context`,
    written in the format the tool description gives you. **You already
    have model access — do this yourself.** Contexo only calls its own
    Anthropic API (and needs `ANTHROPIC_API_KEY`) as a fallback when
    `contexo handoff` runs from a bare terminal with no agent in the loop.
    Inside a live session, there's no reason to make Contexo place a
    second, redundant, separately-billed model call — you're already
    running.
- **write_handoff** — writes a finished handoff brief straight into the
  target harness's config file (`CLAUDE.md`, `AGENTS.md`, or
  `.cursorrules`). Combined with self-compression above, this means you
  can do a *complete* handoff — compress, reconcile against what's already
  there, write the file — without Contexo ever touching an LLM. Before
  calling it: read the target config file yourself (you already have file
  tools) to see if a Contexo block is already there, and if so, reconcile
  your new brief against it — carry every Dead end forward regardless of
  whether it's mentioned again, and don't restate a superseded Decision as
  still current. That's the whole point of the Dead ends / diff-aware
  design; do it the same way Contexo's own compression prompt does.
- **load_context** — load a previously-saved session by id or id prefix.
  Returns the compressed version if one exists, otherwise raw.
- **estimate_cost** — tokenize a prompt against a given model and return
  input/output cost estimates. Use this before sending an unusually large
  prompt, or whenever the user asks "how much will this cost."
- **list_sessions** — list recent saved sessions, newest first. Also
  returns `savings_summary` (sessions compressed, tokens saved, approximate
  USD saved, all local to this machine) — use it if the user asks how much
  Contexo has saved them; no separate tool call needed.

## The self-compression path (default — no API key needed)

When the user asks to save or hand off context and you're running inside
an agent (which you are, if you're reading this via MCP): compress the
raw context yourself using the format `save_context`'s `compressed_context`
parameter describes, pass it there, then call `write_handoff` to write it
into the target file. Two tool calls, zero Anthropic API calls, uses the
model access you already have.

## The CLI fallback (needs ANTHROPIC_API_KEY)

`contexo handoff <claude-code|codex|cursor>` (and `contexo budget` /
`contexo run -- <cmd>`) are terminal-only commands, not MCP tools, since
they wrap external processes. If the user wants to run these from their
terminal directly rather than through you, that's fine — `contexo handoff`
falls back to its own Anthropic API call (needs `ANTHROPIC_API_KEY` set) in
that no-agent-in-the-loop case. Note it does this even if you already saved
a `compressed_context` via `save_context`: whenever the handoff is
cumulative (part of a `--continues` chain) or there's already a brief in
the target file to diff against, it discards any cached compression and
recomputes fresh — those two cases are exactly the ones that need
reconciling against state the cache can't know about. So the terminal path
only skips the API call for the simplest case: one session, no prior
handoff in the target file yet.

## Save proactively — don't wait to be asked (auto-compact)

There is no reliable "the session is about to close" signal an MCP server can
see, so the mitigation lives here, in your own judgment: call `save_context`
(with `compressed_context`, per above — it costs nothing extra) *before* the
user has to ask, not just when they explicitly say they're switching tools.
Do this when you notice any of:

- The conversation has grown long or the task has clearly reached a
  checkpoint (a decision made, a change landed, a natural pause).
- You sense the session is wrapping up — the user is signaling they're done
  for now, or you're approaching a context limit.
- The user mentions closing the terminal, restarting, or coming back later.

Saving early and re-saving as things change is cheap and reversible; losing
an uncompressed session because nobody called `save_context` in time is not.
This is the only real form of "auto-compact" available without a harness-level
lifecycle hook — treat it as a standing instruction, not a one-off reminder.

## When there's no active Contexo session yet

If `list_sessions` comes back empty and the user asks to "save" or "hand
off" the current conversation, use `save_context` with the conversation
so far as `context` (and your own compression as `compressed_context`)
before calling `write_handoff`.
