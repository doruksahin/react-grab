---
status: draft
date: 2026-04-05
---

# PRD-002 Embedded Dashboard Sidebar

## Problem Statement

React-grab currently splits its workflow across two separate surfaces: the **floating toolbar** (element selection, comments, copy) and a **standalone dashboard app** (`packages/dashboard/`) for reviewing groups, viewing screenshots, and creating JIRA tickets. This forces developers to context-switch between the page they're inspecting and a separate browser tab to manage their feedback.

The dashboard is a full React app with its own router, build pipeline, and deployment — yet its entire data set comes from the same sync-server that react-grab already talks to. Maintaining two apps doubles the surface area for bugs, onboarding friction, and dependency drift.

The target user is a developer or QA engineer who has selected elements and left comments via react-grab and now wants to review, organize, and escalate those selections — without leaving the page they're working on.

## Requirements

Embed all `packages/dashboard/` capabilities — group management, detail views, and JIRA integration — into the react-grab floating UI as a sidebar overlay built with Solid.js inside Shadow DOM. The work is split into four phases; each phase delivers a usable increment with a clear checkpoint before proceeding.

### Phases

#### Phase 1 — Sidebar Shell + Groups List (read-only)

**Requirements:**
- A new **dashboard button** on the floating toolbar opens a left-anchored sidebar
- The sidebar **overlays** the host page (no layout shift — the host page must not move or resize)
- The sidebar renders inside react-grab's existing Shadow DOM host for style isolation
- The sidebar is dismissible via close button, the toolbar toggle, or pressing Escape
- When the sidebar opens, focus moves into it; pressing Escape returns focus to the dashboard button
- Display all selection groups with: name, selection count, status badge (open / ticketed / resolved), JIRA ticket ID as a clickable link (if ticketed), inline list of comments per group showing component name, comment text, and HTML tag (truncated to 3 items with "+N more" overflow)
- Summary stats bar: total groups, total selections, open count, ticketed count
- Filter tabs: All, Open, Ticketed, Resolved
- Clicking a group navigates to its detail view within the sidebar
- Empty state: when no groups exist, show a message directing the user to select elements first
- Error state: when the sync-server is unreachable, show a clear error with retry action
- Sync-connection status indicator in the sidebar header (carries over from dashboard layout)

**Checkpoint:** A developer can open the sidebar and browse their groups without leaving the host page.

#### Phase 2 — Group Detail View

**Requirements:**
- Back button returns to the groups list
- Show group name and status badge
- List all selections in the group with:
  - Component name (highlighted)
  - HTML tag badge
  - Comment text
  - Source file path and line number (extracted from content)
  - Timestamp (human-readable relative time)
  - Element screenshot thumbnail
  - Full-page screenshot thumbnail (both types displayed, labeled)
  - CSS selector
  - Collapsible raw HTML content (collapsed by default)
- Empty state: when a group has no selections, show a message
- Screenshots lazy-load with placeholder skeleton

**Checkpoint:** Full read-only parity with the dashboard's group detail page — verified by comparing rendered fields side-by-side.

#### Phase 3 — JIRA Integration

**Requirements:**
- For **open** groups: show "Create JIRA Ticket" button in the detail view
- Create JIRA ticket inline via modal/dialog:
  - Searchable project selector
  - Searchable issue type selector
  - Priority selector
  - Summary field (auto-generated from group name and component names, editable)
  - Description field (auto-generated markdown with group info, selections, and selectors, editable)
  - Attachments section showing count and filename list of screenshots that will be attached
- JIRA base URL resolved from sync-server configuration (not hardcoded)
- For **ticketed** groups: show JIRA status banner with ticket ID (linked to JIRA), current status text, and progress dots (created → to do → in progress → done)
- Poll JIRA ticket status every 30 seconds while the detail view is open
- Status transitions: open → ticketed (on ticket creation), ticketed → resolved (when JIRA status reaches "done")
- Error states: JIRA auth failure shows inline error with guidance; ticket creation failure shows error with retry
- Dialog popovers must render correctly within Shadow DOM (no portaling to `document.body`)

**Checkpoint:** A developer can create and track a JIRA ticket entirely from the sidebar — end-to-end flow verified.

#### Phase 4 — Data Layer + Polish

**Requirements:**
- TypeScript types and runtime validators generated from the OpenAPI spec (no hand-written API types)
- The sidebar data layer must not depend on React-specific libraries
- Reuse the sync-server API endpoints already defined in the OpenAPI spec (`/workspaces/`, `/jira/`)
- Screenshots served from the same R2-backed endpoint
- Focus trapping: when sidebar is open, Tab cycles within it; Escape dismisses
- Sidebar announces open/close state to assistive technology (`aria-modal`, `role="dialog"`)
- Performance: sidebar opens and renders groups list in under 200ms for cached data, measured via `performance.mark` / `performance.measure` in the sidebar component
- The sidebar works in the same browsers and viewports that react-grab already supports

**Checkpoint:** Feature parity confirmed against `packages/dashboard/` — the dashboard can be marked as deprecated.

## Success Criteria

- A developer can select elements, open the sidebar, review their groups, and create a JIRA ticket **without leaving the host page** — zero tab switches
- The host page layout does **not** shift, resize, or reflow when the sidebar opens or closes
- All features currently in `packages/dashboard/` are available in the sidebar: groups list with stats and filters, group detail with all selection fields and both screenshot types, JIRA ticket creation with attachment preview, JIRA status tracking with progress visualization
- Sidebar opens and renders groups list in under 200ms for cached data (measured via `performance.mark` / `performance.measure`)
- `packages/dashboard/` can be marked as deprecated after Phase 4 checkpoint passes
- API types are generated from the OpenAPI spec — no hand-written type definitions for API responses

## Risks

- **Shadow DOM portal conflicts:** JIRA create dialog uses popovers/selects that may try to portal outside the Shadow DOM. Mitigation: all overlay elements must render within the Shadow DOM root, using Solid.js positioning utilities instead of `document.body`-based portals.
- **Sidebar on narrow viewports:** A 380px sidebar overlaying a narrow viewport obscures most of the host page. Mitigation: accept this for v1 (react-grab targets desktop), revisit if usage data shows narrow-viewport adoption.
- **Z-index stacking:** The sidebar must layer below selection labels and the overlay canvas but above the toolbar menu. Mitigation: define a z-index contract in Phase 1 before other phases add more layers.
- **Data layer migration:** The dashboard's entire API surface is built on React Query hooks generated by Orval. Rebuilding this for Solid.js is the highest-effort task in Phase 4. Mitigation: the companion ADR will evaluate codegen strategies; the OpenAPI spec and Zod schemas are framework-agnostic and reusable regardless of the fetching layer chosen.

## Scope

**In scope:** Sidebar UI (Solid.js, Shadow DOM), groups list view, group detail view, JIRA ticket creation and status tracking, spec-driven type generation, overlay positioning, error and empty states, keyboard accessibility and focus management.

**Out of scope:** Settings page (dashboard has a TODO settings route — not needed yet), multi-workspace selector (hardcoded workspace ID carries over for now), real-time WebSocket sync (current polling is sufficient), removing `packages/dashboard/` (separate deprecation task after Phase 4 checkpoint passes), mobile/responsive sidebar layout (react-grab targets desktop browsers). Tooling decisions (Orval, Zod, Solid.js data primitives) are recorded in a companion ADR, not this PRD.
