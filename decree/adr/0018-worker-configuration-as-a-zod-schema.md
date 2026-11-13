---
date: '2026-11-13'
references:
- ADR-0003
- SPEC-003
status: accepted
---

# ADR-0018 Validate Worker configuration with a Zod schema, not an env library

## Context and Problem Statement

`packages/sync-server` talks to Jira with HTTP Basic auth built from three values: `JIRA_BASE_URL`, `JIRA_EMAIL` and `JIRA_API_TOKEN`. Together they decide **which Jira site every ticket is created on and which user creates it**. Until now none of them were validated.

Two concrete defects came out of that:

- `JIRA_EMAIL = ""` sat in the committed `[vars]` block of `wrangler.toml` as a placeholder meant to be overridden by `.dev.vars`. An empty string is a valid string, so a misconfigured deployment would build an `Authorization: Basic base64(":token")` header and fail against Jira with an opaque 401 rather than at startup.
- `JIRA_API_TOKEN` was declared nowhere except the gitignored `.dev.vars`. A new developer had no committed file telling them it was needed; the only record was a prose line in `CLAUDE.md`.

The question raised was whether to adopt an environment library — specifically `@t3-oss/env-core`, the T3 stack's answer — or to solve it with what the repository already has.

## Decision Drivers

- The repository is already a Zod-schema-driven codebase: `packages/sync-server/src/schemas/` is the declared single source of truth for the API contract, and the Zod → OpenAPI → Orval chain derives every typed client from it.
- Agents working in this repository are instructed to load `architecture.yml` and then read `src/schemas/`. Configuration should be findable by that same path, with no second concept to learn.
- Least ongoing maintenance, and no dependency that earns less than it costs.

## Considered Options

### Option A — `@t3-oss/env-core`

The headline feature of t3-env is **separating server from client environment variables so a server secret cannot be bundled into client code**, enforced through a `clientPrefix` and a split schema.

That feature does not apply here. A scan of this repository found that **the Worker is the only package that reads an environment variable at all**. `packages/dashboard`, `packages/e2e-app` and `packages/website` read none in their own source; the `VITE_*` values documented in `CLAUDE.md` are read by the *consuming* application (AdCreative-Frontend-V2), not by anything in this repository. The published `react-grab` library takes its configuration as arguments to `initSync()`, which is correct for a library and must stay that way.

t3-env is also an awkward fit for the runtime. It is built around a module-scope `process.env`, which Cloudflare Workers leaves empty unless `nodejs_compat_populate_process_env` is on — a flag that is only default from compatibility date `2025-04-01`, while this Worker is pinned to `2024-12-01`. It can be made to work by passing `runtimeEnv: env` from the `cloudflare:workers` import, which the t3-env docs support as a "custom runtime" object, but the documented happy path is unavailable.

So Option A adds a dependency, introduces a second vocabulary for "what shape must this data have" next to the five existing Zod schemas, and the one thing it would buy us is a protection against a leak that cannot happen in this repository.

### Option B — a Zod schema in `src/schemas/`, adopted

Describe the configuration as `src/schemas/env.ts`, beside `comment.ts`, `group.ts`, `jira.ts` and `common.ts`, and parse it in the composition root that already reads those values.

This is not a custom mechanism. It is `z.object().safeParse()` — the library's primary documented use, already applied five times in that exact folder, with the dependency already installed (`zod` 4.3.6).

### Option C — Cloudflare's own tooling, rejected on evidence

Two Cloudflare features looked like they belonged here and were tried:

- **`wrangler types`** to replace the hand-written `Bindings` type. Running it produced a 467 KB generated file that types `[vars]` as *literal* values (`JIRA_BASE_URL: "https://appier.atlassian.net"`, `JIRA_EMAIL: ""`) and omits `JIRA_API_TOKEN` entirely, because a secret is declared nowhere. That is less useful and far less readable than the seven-line hand-written type it would replace.
- **`[secrets] required = [...]`** for deploy-time validation. Added to `wrangler.toml` and run through `wrangler deploy --dry-run` on Wrangler 4.79, it was silently ignored — no error, and no mention in the resolved bindings. Config that silently does nothing is worse than no config, because it creates false confidence.

Neither is adopted. Both should be revisited on a Wrangler upgrade.

## Decision

Option B. Worker configuration is a Zod schema in `src/schemas/env.ts`, parsed by `parseJiraEnv()` in `middleware/inject-repos.ts` — the single place the configuration is read, and therefore the single place it is validated.

Supporting changes:

- `JIRA_EMAIL = ""` is removed from the committed `[vars]`. An empty placeholder that must be overridden to work is a trap; absence now fails loudly.
- `.dev.vars.example` is committed, naming every value, where production gets it from, and where to create an Atlassian token.
- Validation runs per request rather than being cached at module scope. Cloudflare documents that an isolate may be reused when only bindings change, so a cached value can outlive a rotated secret. The cost is one `safeParse` of three strings.

## Consequences

**Good.** One vocabulary for data shapes across the whole server. Configuration is discoverable on the path agents already follow. A misconfiguration now fails on the first request with every problem named at once, instead of an opaque Jira 401 later. No new dependency.

**Bad.** `/health` fails when Jira is misconfigured, because the middleware runs for every route. This is a deliberate trade: a readiness probe that reports healthy on a Worker that cannot do its job is misleading. If a Jira-independent health check is ever needed, construct `JiraService` lazily rather than moving the validation.

**Revisit when** this repository gains a surface that bundles server and client code together — a Next.js application with real secrets, for example. At that point the leak protection t3-env provides becomes real and Option A should win. Revisit Option C on a Wrangler upgrade.
