# dashboard — Package Guide

React Vite SPA for the sync-server workspace. React 19, React Router 7, TanStack Query v5.

## Key differences from react-grab

This package uses **React** (not Solid.js) and has its own tooling:

| Concern | dashboard | react-grab |
|---|---|---|
| UI framework | React 19 | Solid.js |
| Styling | Tailwind v4 + `@tailwindcss/vite` | Tailwind v4 + `@tailwindcss/cli` |
| Components | shadcn + `@base-ui/react` + Radix | Kobalte + custom Solid components |
| Lint | ESLint (flat config) | oxlint |
| Format | Prettier | oxfmt |
| API client | Orval-generated hooks | Orval-generated hooks |

## API client (Orval + TanStack Query)

Generated from the same `sync-server/openapi.json` as react-grab:

```bash
pnpm --filter dashboard codegen
```

Output structure:
```
src/api/
  endpoints/
    comments/comments.ts       — generated hooks (useGetComments, etc.)
    comments/comments.msw.ts   — MSW mock handlers
    groups/groups.ts
    jira/jira.ts
    screenshots/screenshots.ts
    health/health.ts
  model/                        — generated request/response types
```

## Talking to the sync server

The dev server proxies `/workspaces`, `/jira` and `/health` to the sync server (`VITE_SYNC_SERVER_URL`, default the deployed Worker — there is no separate local backend; point it at `http://localhost:8787` only while changing the server itself). The sync server requires a bearer token (ADR-0020); the proxy adds it from `SYNC_API_TOKEN`, so put that in the gitignored `.env.local`. It deliberately has no `VITE_` prefix, so it never reaches browser code — and `<img>` screenshot requests carry it too, because they go through the same proxy.

## MSW mocking

Mock handlers are auto-generated alongside the API client. Use for dev without a running sync-server:

```bash
pnpm --filter dashboard dev:mock
```

Mock setup in `src/mocks/browser.ts` + `src/mocks/handlers.ts`.

## Project structure

```
src/
  pages/          — route components (groups/list, groups/detail, selections/list, etc.)
  components/
    layout/       — dashboard shell
    jira/         — JIRA-specific components
    shared/       — cross-page components
    ui/           — shadcn primitives
  api/            — Orval-generated client (do not edit manually)
  hooks/          — custom hooks
  lib/            — config, query client, utilities
```
