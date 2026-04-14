# Style Conventions

## Linting & Formatting
- **Linter**: oxlint (not ESLint) — run via `pnpm lint` / `pnpm lint:fix`
- **Formatter**: oxfmt — run via `pnpm format`

## Language
- TypeScript with strict mode
- ES modules (`"type": "module"` everywhere)

## UI Framework
- Core library internals use **Solid.js** (not React)
- React is an optional peer dependency for fiber inspection via `bippy`
- Components use `.tsx` extension with Solid JSX

## Styling
- Tailwind CSS v4 with custom CSS build pipeline
- Class merging via `tailwind-merge`
- Variant management via `cva` (class-variance-authority beta)
- CSS rem-to-px conversion post-processing (`scripts/css-rem-to-px.mjs`)

## Project Structure
- Monorepo with `packages/*` workspaces
- Core source in `packages/react-grab/src/`
  - `core/` — selection engine, store, events, plugins, keyboard, theming
  - `components/` — UI components (sidebar, toolbar, overlay, context-menu)
  - `features/` — feature modules (screenshot, selection-groups, sidebar, sync)
  - `generated/` — Orval codegen output (do not edit manually)
  - `utils/` — shared utilities

## Build
- Library built with tsup
- Apps/extension built with Vite
- Turborepo for task orchestration and caching
