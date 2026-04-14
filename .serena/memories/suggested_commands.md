# Commands

## Root-level (run from repo root)

| Command | What it does |
|---------|-------------|
| `pnpm build` | Build react-grab, CLI, shadcn-registry, and grab packages |
| `pnpm dev` | Dev mode for react-grab + CLI (with CSS watch + tsup watch) |
| `pnpm test` | Run tests for react-grab + CLI (Playwright E2E) |
| `pnpm typecheck` | TypeScript check on react-grab |
| `pnpm lint` | oxlint on react-grab |
| `pnpm lint:fix` | oxlint --fix on react-grab |
| `pnpm format` | oxfmt (formatting) |
| `pnpm extension:dev` | Dev mode for browser extension |
| `pnpm extension:build` | Build browser extension |
| `pnpm sync:dev` | Dev mode for sync server |
| `pnpm check:codegen` | Export API spec, run codegen, verify no diff |
| `pnpm changeset` | Create a changeset for versioning |
| `pnpm release` | Build + publish via changesets |

## Package-level (react-grab)

| Command | What it does |
|---------|-------------|
| `pnpm --filter react-grab test:unit` | Vitest unit tests |
| `pnpm --filter react-grab test:unit:watch` | Vitest watch mode |
| `pnpm --filter react-grab test:e2e` | Playwright E2E tests |
| `pnpm --filter react-grab test:e2e:ui` | Playwright UI mode |
| `pnpm --filter react-grab css:build` | One-shot Tailwind CSS build |
