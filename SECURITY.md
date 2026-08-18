# Security Policy

## Reporting a Vulnerability

If you find a security issue in Contexo, please **do not open a public
GitHub issue**. Instead, email the maintainer listed in `package.json`, or
use GitHub's private [security advisory](https://github.com/maheedhar132/Contexo/security/advisories/new)
form for this repository.

Please include:
- A description of the issue and its impact
- Steps to reproduce, or a minimal proof of concept
- The version of Contexo affected

## Scope

Contexo runs entirely locally (SQLite at `~/.contexo`, your own API keys).
Security issues of particular interest:
- Anything that lets a wrapped command's output influence Contexo in
  unintended ways (e.g. the budget-cap cost scanner in
  `src/commands/budget.ts`)
- Anything that writes outside `~/.contexo` or the target project directory
  without the user asking for it (e.g. `contexo handoff`'s config-file
  writers in `src/adapters/`)
- Dependency vulnerabilities in the published package

## Response

This is an early-stage, actively maintained open-source project. Reports
will be acknowledged as soon as possible; there's no formal SLA yet given
the project's size.
