---
date: '2026-11-15'
references:
- ADR-0005
- ADR-0006
- ADR-0014
status: accepted
---

# ADR-0022 Overlay UI in three layers: tokens, primitives, feature components

## Context and Problem Statement

The overlay looks like several tools stacked on the page: the toolbar, floating labels, sidebar and dialogs each choose their own greys, sizes and status styles (audit: the "React Grab UI proposal" design canvas, board 1). The cause is not missing infrastructure. The layers exist and are bypassed:

- **Tokens** live in `styles.css` under Tailwind v4 `@theme`, yet about 20 hard-coded colours sit in components, and 66 text classes are 7–10 px.
- **Primitives** live in `components/ui/` (Menu, Select, Combobox, Tooltip, Collapsible on Kobalte; Button on `cva`), yet 50 raw `<button>` tags in 30 feature files style themselves; three files use `Button`.
- **Positioning**: ADR-0005 chose `@floating-ui/dom` with `strategy: 'fixed'` for floating elements in the Shadow DOM. The labels and the group menu instead use hand-written `utils/clamp-to-viewport.ts` and `utils/get-anchored-dropdown-position.ts`, which is why labels clip each other and the group menu leaves the viewport (S3.5).
- **Status colours** are domain data: `features/sidebar/status-colors.ts` maps the ten ATT workflow statuses (ADR-0006, SPEC-004). That mapping is correct and must stay where it is.

We want a consistent UI without touching domain logic, the test contract, or adding dependencies.

## Considered Options

1. **Restyle each component in place.** Fastest per screen, but repeats today's problem: every component keeps its own styles, and the next change drifts again.
2. **Adopt the AdCreative React component library.** Rejected: the overlay is Solid inside a Shadow DOM, and the library is React 19; mounting it means a second UI runtime in a dev tool.
3. **Add another Solid component kit** (corvu, Ark UI). Rejected for now: Kobalte already provides the primitives we need, and ADR-0005 found corvu has the same portal limitation in the Shadow DOM.
4. **Enforce the three layers that exist, with the libraries already installed.**

## Decision Outcome

**Option 4.** Each layer has one job, and feature components only compose:

| Layer | Owns | Built with | Never contains |
|---|---|---|---|
| Tokens (`styles.css` `@theme`) | colour, type scale, radius, spacing, shadow values | Tailwind v4 `@theme` | component structure |
| Primitives (`components/ui/`) | how a control looks and behaves: Button, IconButton, StatusChip, StatusDot, Badge, Avatar, Tabs, SwatchGroup, ActionList, Pin, Menu, Select, Tooltip, Popover, Toast | Kobalte for behaviour and accessibility, `cva` for variants, `@floating-ui/dom` for placement (ADR-0005) | domain rules, data fetching |
| Feature components (`components/<feature>/`) | which primitives a screen uses and in what order | the primitives | hex colours, arbitrary `px` text sizes, raw `<button>` styling, positioning maths |
| Domain (`features/<feature>/business`) | rules, including which colour a status gets (ADR-0006) | plain TypeScript | JSX, signals |

- **Libraries, all already dependencies:** Kobalte `Tooltip`, `Popover`, `DropdownMenu`, `Toast` and `Image` (avatar with initials fallback) in 0.13.11; `cva` for variants; `@floating-ui/dom` `computePosition` with `flip`, `shift` and `size` for labels and menus. Playwright's built-in `toHaveScreenshot` guards each surface's appearance.
- **Custom code that remains, and why:** keeping several label pins near one element from overlapping. Floating UI places one element against one reference; no library spreads several floating elements apart. It is one pure function in `business/` with its own test.
- **Status chip:** the primitive owns the shape (dot, label, sentence case); the colour per status keeps coming from `status-colors.ts`. Moving those values onto tokens is allowed; moving the mapping out of the domain is not.
- **Status dot:** the coloured dot of a status, used by the status chip and the status legend; the colour comes from the domain.
- **Badge:** a neutral pill for Jira labels, filter chips and counts; it carries no status meaning.
- **Fixed contract:** every `data-react-grab-*` attribute and its scope, the roles and accessible names tests use, the z-index layers and the Shadow DOM mount stay as they are.
- **Order:** tokens first, then primitives, then layout one scenario per change. The first two change no behaviour; layout changes are approved one by one.

### Consequences

- Good: a look change is a token or primitive change, made once (SRP, DRY); feature files shrink to composition.
- Good: the hand-written positioning code is removed in favour of the library ADR-0005 already chose: `utils/floating.ts` wraps `computePosition` + `autoUpdate` with `strategy: "fixed"`: `trackFloating` (imperative), `createFloating` (Solid: position, a left/top/visibility style, reset) and `virtualReference`, with offset, flip, shift, size and arrow middleware. Overlays with a trigger use Kobalte (DropdownMenu, Popover, including the group picker).
- Good: one new direct dependency only, `@kobalte/utils` at the version `@kobalte/core` already resolves; it replaces hand-written event-handler composition with the helpers Kobalte itself uses.
- Bad: migrating 50 raw buttons and the positioning utilities touches many files; screenshot tests are needed so the migration is reviewed by image, not by reading diffs.
- Neutral: `pnpm lint` enforces the rule in `packages/react-grab/src/components/` outside `components/ui/` (`packages/react-grab/.oxlintrc.json`): oxlint's built-in `react/forbid-elements` rejects a raw `<button>`, and the JS plugin `scripts/oxlint/overlay-ui-plugin.mjs` rejects hex and `rgb()`/`hsl()` colours and `text-[Npx]` sizes in string literals. Jira's own colours (priority, issue type, editor text colours) are data and live in `features/`. The same config keeps JSX out of `src/features/` (`overlay-ui/no-jsx`; the dev-mode context provider is exempt), rejects `as="button"` triggers, and limits `components/ui/` imports to `ui/`, `utils/` and `constants` (built-in `no-restricted-imports`).
- Neutral: `styles.css` resets Tailwind's default palette and text sizes (`--color-*: initial`, `--text-*: initial`) and declares only the overlay's tokens, so an off-token class such as `bg-red-500` or `text-sm` generates nothing.
- Neutral: primitives own their appearance, so a fixed pixel size inside `components/ui/` (for example the avatar initials) is allowed; the planned lint rule applies outside `components/ui/` only.

### Rollout

Done on branch `claude/ui-layers-tokens`, one scenario per change, each reviewed by screenshot (`e2e/mocked/overlay-surfaces-visual.spec.ts`).

- **Before step 1:** this ADR (c439d406); a screenshot per overlay surface (f9f16bf9).
- **Step 1, tokens:** the design-system palette and a five-step type scale in `styles.css` (4e15c673).
- **Step 2, primitives:** IconButton, StatusChip and Avatar (f976a8e2, 2afd147b); feature components compose primitives only, primitives in `components/ui/` (5f93f247, ddd8622d); Kobalte Tabs, ToggleGroup and MenuList (6adb7248, ec8a4ecf, fdc1c5c8); positioning on Floating UI (f235c720, f1d88946).
- **Step 3, layout:** composer and sidebar status chips, offline banner with a Retry that reconnects and sends offline changes (374eb72c, 25bdbbae); Jira dialog with summary first, destination line from `GET /jira/site` and a description preview (6ef43ade, f503703d); saved labels as pins that open a card, with the thread in the sidebar (2c19f4ee, cd312d10).

Known limits:

- Pin stacking (`stack-pins.ts`) uses the elements' positions; a pin Floating UI shifts back inside the viewport at the edge can still overlap a neighbour (risk R-006).
- A pin opens its card on click or Enter, not on hover.
- Screenshot baselines exist for chromium-darwin only.
- `GET /jira/site` needs a Worker deploy; until then the Jira dialog says "Into ATT" without the site.
