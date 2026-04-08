# React Grab — Local Setup (AdCreative)

This is the AdCreative fork of [react-grab](https://github.com/aidenybai/react-grab). It ships two pieces we care about:

1. **`react-grab`** — the in-page overlay library consumed by `AdCreative-Frontend-V2`.
2. **`@react-grab/sync-server`** — a Cloudflare Worker (Hono + D1 + R2) that persists selections, screenshots, and JIRA integration state.

Both run locally against `AdCreative-Frontend-V2` at `/Users/doruk/Desktop/ADCREATIVE/AdCreative-Frontend-V2`.

---

## 1. Prerequisites

- Node.js `>= 22.18` (AdCreative requirement; react-grab itself only needs `>= 18`).
  If you use `nvm`: `nvm install 22 && nvm use 22`.
- pnpm `>= 9` (repo is pinned to `pnpm@10.24.0` via `packageManager`). Install with
  `corepack enable && corepack prepare pnpm@10.24.0 --activate`.
- Both repos cloned as **siblings** under the same parent directory:
  ```bash
  mkdir -p ~/ADCREATIVE && cd ~/ADCREATIVE
  git clone <react-grab-fork-url> react-grab
  git clone <adcreative-frontend-v2-url> AdCreative-Frontend-V2
  ```
  Resulting layout:
  ```
  ADCREATIVE/
  ├── react-grab/                 ← this repo
  └── AdCreative-Frontend-V2/
  ```
  The sibling layout matters — AdCreative's `pnpm-lock.yaml` resolves
  `react-grab` to `link:../react-grab/packages/react-grab`. Any other layout
  breaks the symlink.

---

## 2. Install & start the dev servers

From **each** repo's root, install dependencies:

```bash
cd ~/ADCREATIVE/react-grab && pnpm install
cd ~/ADCREATIVE/AdCreative-Frontend-V2 && pnpm install
```

Installing in AdCreative is what materializes the `node_modules/react-grab`
symlink pointing back to this repo.

You need **two processes** running in parallel. Open two terminals (or use tmux):

### Terminal A — `react-grab` library (watch build)

```bash
pnpm dev
```

This runs `turbo dev --filter=react-grab --filter=@react-grab/cli`, which:
- watches `packages/react-grab/src` and rebuilds `dist/` via `tsup`
- rebuilds the Tailwind stylesheet on change

Because AdCreative symlinks `react-grab` into its `node_modules`, any change
here is picked up by Vite HMR on the AdCreative side — no reinstall needed.

### Terminal B — `@react-grab/sync-server` (Cloudflare Worker)

```bash
pnpm sync:dev
```

This runs `wrangler dev` in `packages/sync-server`. By default it serves on
**`http://localhost:8787`** with a local D1 database and local R2 bucket (see
`packages/sync-server/wrangler.toml`).

First-run only — apply migrations to the local D1:

```bash
pnpm --filter @react-grab/sync-server db:migrate:local
```

> The Worker reads JIRA credentials from `packages/sync-server/.dev.vars`
> (gitignored). If you need JIRA create-issue to work locally, create the file
> with:
>
> ```dotenv
> JIRA_EMAIL=you@adcreative.ai
> JIRA_API_TOKEN=<token>
> ```
>
> Generate a token at <https://id.atlassian.com/manage-profile/security/api-tokens>.
> Without it the rest of the server still runs — you just can't create issues.

If port `8787` is already in use, pass `--port` to wrangler:
`pnpm --filter @react-grab/sync-server exec wrangler dev --port 8788` (and
update `VITE_REACT_GRAB_SYNC_URL` in AdCreative to match).

---

## 3. How AdCreative is wired to this repo

On the current `AdCreative-Frontend-V2` branch you don't need to do anything —
it's already connected. Sections 3.1 – 3.3 document the pieces that make it
work so you can reproduce the wiring on a fresh clone, a new branch, or
another Vite + React repo.

### 3.1 Add `react-grab` as a dependency

`AdCreative-Frontend-V2/package.json` declares:

```json
"dependencies": {
  "react-grab": "^0.1.29"
}
```

The published version string doesn't matter in dev — what actually resolves
the package is the entry in `AdCreative-Frontend-V2/pnpm-lock.yaml`:

```yaml
react-grab:
  specifier: ^0.1.29
  version: link:../react-grab/packages/react-grab
```

This `link:` resolution is what points `node_modules/react-grab` back at this
repo. As long as the committed `pnpm-lock.yaml` has that line, `pnpm install`
preserves the symlink. If you ever need to recreate it from scratch (new repo,
blown-away lockfile), force the local link explicitly:

```bash
cd AdCreative-Frontend-V2
pnpm add link:../react-grab/packages/react-grab
```

Then verify:

```bash
ls -la node_modules/react-grab
# → node_modules/react-grab -> ../../react-grab/packages/react-grab
```

### 3.2 Initialize react-grab in `src/app/main.tsx`

Add this block at the **top** of `AdCreative-Frontend-V2/src/app/main.tsx`
(before `import 'reflect-metadata'` and the rest of the bootstrap). It
dynamically imports `react-grab/core` in dev only and calls `initSync({ ... })`
with values from env vars:

```ts
if (import.meta.env.DEV) {
  const syncServerUrl = import.meta.env.VITE_REACT_GRAB_SYNC_URL ?? ''
  const syncWorkspace = import.meta.env.VITE_REACT_GRAB_SYNC_WORKSPACE ?? ''

  import('react-grab/core').then(({ initSync }) =>
    initSync({
      enabled: Boolean(syncServerUrl && syncWorkspace),
      serverUrl: syncServerUrl,
      workspace: syncWorkspace,
      syncRevealedState: false,
      jiraProjectKey: 'ATT',
      onSyncError: (error) => console.error('[react-grab sync]', error),
      options: {
        screenshot: { enabled: true },
      },
    }).then(() => import('react-grab')),
  )
}
```

Notes:
- The `import.meta.env.DEV` guard ensures react-grab is completely absent from
  production bundles.
- `enabled: Boolean(...)` means if either env var is missing, the overlay
  still loads but sync is disabled (no server calls, no sidebar persistence).
- `jiraProjectKey: 'ATT'` is AdCreative's JIRA project — change if your team
  uses a different key.

### 3.3 Create `.env.local` with the sync server config

`AdCreative-Frontend-V2/.env.local` is **gitignored**, so every developer
creates their own. Add:

```dotenv
# AdCreative-Frontend-V2/.env.local
VITE_REACT_GRAB_SYNC_URL=http://localhost:8787
VITE_REACT_GRAB_SYNC_WORKSPACE=<your-name>-workspace
```

- `VITE_REACT_GRAB_SYNC_URL` must match the port your local `pnpm sync:dev` is
  serving on (default `8787`).
- Pick a unique `VITE_REACT_GRAB_SYNC_WORKSPACE` per developer to keep your
  selections separate from teammates sharing the same sync server (even
  locally this keeps test data tidy).

Restart Vite (`pnpm dev` in AdCreative) after creating or editing
`.env.local` — Vite only reads env files at startup.

---

## 4. Running the full stack

```bash
# in react-grab/
pnpm dev           # terminal A — library watch
pnpm sync:dev      # terminal B — sync-server on :8787

# in AdCreative-Frontend-V2/
pnpm dev           # terminal C — app (Vite)
```

Open the AdCreative app in your browser. Hover any element and press the
configured activation key (default **⌘C** on Mac / **Ctrl+C** on Win/Linux —
the overlay intercepts the combo only while hovering a grab target, so normal
copy still works elsewhere). Selections should appear in the sidebar and
persist to the local sync server.

Sanity check the sync server is reachable:

```bash
curl http://localhost:8787/health   # returns { ok: true }
# or open http://localhost:8787/swagger in a browser for the OpenAPI UI
```

---

## 5. Troubleshooting

- **Selections don't persist / sidebar empty.** Confirm Terminal B is running
  and `VITE_REACT_GRAB_SYNC_URL` in AdCreative matches its port.
- **`react-grab` changes not reflected.** Make sure Terminal A (`pnpm dev`) is
  running and that `AdCreative-Frontend-V2/node_modules/react-grab` still
  points to `../../react-grab/packages/react-grab` (`ls -la` to check). If not,
  re-run `pnpm install` in AdCreative.
- **D1 errors on first run.** You forgot `db:migrate:local` — see Terminal B
  section.
- **JIRA create fails.** Add credentials to `packages/sync-server/.dev.vars`.
- **`pnpm dev` errors about missing filter / turbo.** Run `pnpm install` at
  the repo root first.
- **Port 8787 or the AdCreative Vite port already in use.** Start wrangler on
  a different port (see §2) and update `VITE_REACT_GRAB_SYNC_URL` to match.

---

## 6. TODO — Production

- [ ] Publish the AdCreative fork of `react-grab` to our internal registry (or
      pin a git SHA) so AdCreative stops relying on the sibling symlink.
- [ ] Deploy `@react-grab/sync-server` to Cloudflare Workers (`wrangler deploy`),
      provision prod D1 + R2, wire JIRA secrets via `wrangler secret put`.
- [ ] Decide prod `VITE_REACT_GRAB_SYNC_URL` and workspace-per-env strategy.
- [ ] Gate react-grab loading in AdCreative prod builds (currently `import.meta.env.DEV` only — confirm this is what we want).
- [ ] CI: run `pnpm check:codegen`, `pnpm typecheck`, `pnpm test` on PRs.

---

## 7. Tech stack & deployment

### `react-grab` (the overlay library)

| Area | Choice |
|---|---|
| UI framework | **Solid.js** (not React — mounted into React apps via a portal) |
| Styling | **Tailwind CSS v4** + `tw-animate-css`, compiled to a static `dist/styles.css` |
| Primitives | `@kobalte/core`, `@floating-ui/dom`, `solid-focus-trap` |
| Editor | `@tiptap/core` + `tiptap-markdown` + `tiptap-extension-jira` |
| Element/DOM | `@medv/finder`, `element-source`, `modern-screenshot`, `bippy` |
| Validation | `zod` |
| Build | **tsup** (ESM + CJS + IIFE `dist/index.global.js`), `@tailwindcss/cli` |
| API client | **Orval** generating a typed client from the sync-server OpenAPI spec (`pnpm codegen`) |
| Tests | **Playwright** (e2e) + **Vitest** (unit) |
| Lint/format | **oxlint** + **oxfmt** |
| **Deployment** | Published to **npm** as `react-grab` (also loadable from unpkg as `dist/index.global.js`). AdCreative currently consumes it via a local symlink; prod path TBD (see TODO). |

### `@react-grab/sync-server`

| Area | Choice |
|---|---|
| Runtime | **Cloudflare Workers** (`wrangler`, `nodejs_compat`) |
| HTTP framework | **Hono** + `@hono/zod-openapi` + `@hono/swagger-ui` |
| Database | **Cloudflare D1** via **drizzle-orm** + `drizzle-kit` migrations (`drizzle/`) |
| Object storage | **Cloudflare R2** (`react-grab-screenshots` bucket) for screenshots |
| Validation / SSOT | **Zod** schemas — exported to `openapi.json` and consumed by react-grab's Orval client |
| JIRA integration | `jira.js` + `adf-to-markdown` / `marklassian` for ADF ⇄ Markdown |
| **Deployment** | **Cloudflare Workers** (`wrangler deploy`). Local dev uses `wrangler dev` with local D1/R2 emulation. Prod deploy TBD (see TODO). |
