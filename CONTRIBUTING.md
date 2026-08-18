# Contributing to Contexo

Contexo is a small, focused CLI. PRs are welcome but the surface area is intentionally kept tight.

## What we want

- **New harness adapters.** Cline, Windsurf, opencode, Aider — each is a ~60-line file. Follow the shape of `src/adapters/claude-code.ts`.
- **Better tokenizer coverage** as providers change models or ship offline tokenizers.
- **Test cases** for compression edge cases and adapter round-trips.
- **Bug fixes** with a repro case.

## What we don't want (yet)

- New commands beyond `save / sessions / show / delete / handoff / estimate / budget / run / mcp`. Extra surface belongs in Pro.
- Cloud sync, team features, dashboards — those live in Contexo Cloud (closed source).
- Framework rewrites. This is a small CLI; keep it small.

## Dev loop

```bash
npm install
npm run dev       # tsup watch
node dist/cli.js --help
npm test
npm run typecheck
```

## Style

- No comments unless the *why* is non-obvious.
- Prefer editing existing files over new abstractions.
- Match the existing kleur/commander/zod style.

## Legal

By opening a PR you agree that your contribution is licensed under Apache 2.0. Do not include code you cannot license this way.
