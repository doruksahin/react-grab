# Dashboard UX Scenario

## The actors

| Actor | Goal |
|---|---|
| **Developer / QA** | Captures selections in the host app via react-grab |
| **PM** | Reviews selections, creates JIRA tickets with evidence, tracks status |
| **Developer (receiving)** | Opens JIRA ticket, sees full context, knows exactly what to fix |

---

## Story 1: PM reviews today's captures

Emma is a PM. She opens the dashboard Monday morning. She doesn't have the app running locally — she doesn't need to.

**What she sees:**

```
┌─────────────────────────────────────────────────────────────┐
│  react-grab dashboard          Workspace: staging-v2        │
├─────────────────────────────────────────────────────────────┤
│  Filters: [All pages ▼] [All components ▼] [Open ▼] [This week ▼]  │
├─────┬──────────────┬────────────────┬──────────┬────────────┤
│  #  │ Component    │ Page           │ Status   │ Captured   │
├─────┼──────────────┼────────────────┼──────────┼────────────┤
│  1  │ CardDesc...  │ /dashboard     │ ● Open   │ 2h ago     │
│  2  │ PriceTag     │ /pricing       │ ● Open   │ 3h ago     │
│  3  │ NavHeader    │ /dashboard     │ ◉ PROJ-89│ Yesterday  │
│  4  │ LoginForm    │ /auth/login    │ ✓ Done   │ 3 days ago │
├─────┴──────────────┴────────────────┴──────────┴────────────┤
│  4 selections · 2 open · 1 ticketed · 1 resolved            │
└─────────────────────────────────────────────────────────────┘
```

She filters by "Open" to see what needs attention. Two new captures from this morning.

## Story 2: PM inspects a selection

Emma clicks on the CardDescription selection. The detail view opens.

**What she sees:**

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to list                                    ● Open   │
│                                                             │
│  CardDescription                                            │
│  /dashboard · captured 2h ago by @alex                      │
│                                                             │
│  ┌─── Comment ────────────────────────────────────────────┐ │
│  │ "The tagline text overflows on mobile viewports.       │ │
│  │  Should truncate or wrap at 2 lines."                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─── Screenshots ────────────────────────────────────────┐ │
│  │  [Full page screenshot]     [Element screenshot]       │ │
│  │  (clickable, zoomable)      (clickable, zoomable)      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─── Component context ──────────────────────────────────┐ │
│  │  Component: CardDescription                            │ │
│  │  Source: src/adc-ui/card/card-description.tsx:38        │ │
│  │  Selector: [data-testid="CardDescription"]             │ │
│  │                                                        │ │
│  │  React tree:                                           │ │
│  │  App > Layout > Dashboard > CardGrid > Card            │ │
│  │    > CardDescription  ← this element                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─── State snapshot ─────────────────────────────────────┐ │
│  │  { viewport: "375x812", theme: "dark", ... }           │ │
│  │  (collapsible JSON viewer)                             │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  [ Create JIRA ticket ]                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Everything needed to understand the issue is on one screen. No "can you send me a screenshot?" No "which component is that?" No "what page were you on?"

## Story 3: PM creates a JIRA ticket with evidence

Emma clicks "Create JIRA ticket." A panel opens with a pre-filled ticket.

**What the form looks like:**

```
┌─── Create JIRA ticket ────────────────────────────────────┐
│                                                            │
│  Project:   [PROJ ▼]                                       │
│  Type:      [Bug ▼]                                        │
│  Priority:  [Medium ▼]                                     │
│                                                            │
│  Summary:   ┌──────────────────────────────────────────┐   │
│             │ CardDescription text overflow on mobile   │   │
│             └──────────────────────────────────────────┘   │
│                                                            │
│  Description: (auto-generated, editable)                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ## What                                             │   │
│  │ The tagline text overflows on mobile viewports.     │   │
│  │ Should truncate or wrap at 2 lines.                 │   │
│  │                                                     │   │
│  │ ## Where                                            │   │
│  │ - Page: /dashboard                                  │   │
│  │ - Component: `CardDescription`                      │   │
│  │ - Source: `src/adc-ui/card/card-description.tsx:38`  │   │
│  │ - Selector: `[data-testid="CardDescription"]`       │   │
│  │                                                     │   │
│  │ ## Component tree                                   │   │
│  │ App > Layout > Dashboard > CardGrid > Card          │   │
│  │   > CardDescription                                 │   │
│  │                                                     │   │
│  │ ## Evidence                                         │   │
│  │ See attached screenshots.                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  Attachments:                                              │
│  ☑ full-page-screenshot.png (auto-attached)                │
│  ☑ element-screenshot.png (auto-attached)                  │
│  ☑ state-snapshot.json (auto-attached)                     │
│                                                            │
│  Assignee:  [Unassigned ▼]                                 │
│  Sprint:    [Current sprint ▼]                             │
│  Labels:    [react-grab, ui-feedback]                      │
│                                                            │
│             [ Cancel ]  [ Create ticket ]                   │
└────────────────────────────────────────────────────────────┘
```

**Key point:** The PM edits, not writes. The description is auto-generated from the selection data. Screenshots are auto-attached. The PM's job is to review, adjust priority, assign, and hit create.

## Story 4: Ticket is linked — visible everywhere

After ticket creation, the link is bidirectional.

**In the dashboard:**

The selection row updates immediately:

```
│  1  │ CardDesc...  │ /dashboard     │ ◉ PROJ-123 │ 2h ago    │
```

The detail view shows the connection:

```
┌─── JIRA ──────────────────────────────────────────────────┐
│  ◉ PROJ-123 — CardDescription text overflow on mobile      │
│  Status: Open · Assignee: @sarah · Sprint: Sprint 24       │
│  [Open in JIRA ↗]                                          │
└────────────────────────────────────────────────────────────┘
```

**In JIRA:**

The ticket has:
- Auto-generated description with component path, source location, selector
- Screenshots attached as files (not links that expire)
- A deep link back to the selection in the dashboard

**In react-grab (the widget):**

The selection label shows a subtle badge:

```
  ┌────────────────────────────┐
  │ CardDescription  PROJ-123  │
  └────────────────────────────┘
```

Clicking the badge opens the dashboard detail view. The widget doesn't do more than this.

## Story 5: Developer receives the ticket

Sarah opens PROJ-123 in JIRA. She sees:

1. **What's wrong** — the PM's comment, in plain English
2. **Exactly where** — component name, source file, line number, CSS selector
3. **What it looks like** — full page + element screenshots, attached to the ticket
4. **Component tree** — she knows the parent hierarchy without opening devtools
5. **Deep link** — she can open the dashboard to see the live selection context

She doesn't need to ask "which page?", "can you send a screenshot?", or "what component is this?" Everything is in the ticket.

## Story 6: Developer resolves, status flows back

Sarah fixes the issue, merges the PR. She moves PROJ-123 to "Done" in JIRA.

The dashboard polls or receives a webhook:
- Selection status updates to **resolved**
- The selection row shows ✓

In react-grab, the badge turns green or disappears. The feedback loop is closed.

---

## What the MVP needs to impress management

The demo story is: "I select an element in the app, and 30 seconds later there's a JIRA ticket with screenshots, source location, and component context — zero manual work."

### MVP scope — the shortest path to that demo

| Must have | Why |
|---|---|
| **Selection list page** | Shows this is a real platform, not a one-off tool |
| **Selection detail page** | Screenshots + component context on one screen — the visual wow |
| **Screenshot capture in widget** | The single most impressive feature. Visual proof beats text. |
| **One-click JIRA creation** | The money shot. Pre-filled ticket with auto-attached screenshots. |
| **JIRA link visible in dashboard** | Shows bidirectional connection — it's not a fire-and-forget |
| **D1 + R2 backend** | Has to work. No faking the storage. |

### Cut from MVP

| Not yet | Why it can wait |
|---|---|
| Bulk operations | One-at-a-time is fine for the demo |
| Advanced filters | A simple status filter is enough |
| Auth / roles | Demo with a single workspace, no login |
| Impair state dump | Plugin integration is extra work, low visual impact |
| Widget status badge | Nice-to-have, not the demo moment |
| JIRA webhook (status sync) | Manual status update is fine for v1 |
| React ancestor tree | Include if easy, but screenshots are the star |

### The PoC demo script

1. Open the host app with react-grab active
2. Select a `CardDescription` element
3. Add a comment: "Text overflows on mobile"
4. → Screenshot is captured automatically (visible in the widget briefly)
5. Open the dashboard in another tab
6. → The selection appears with screenshots and component context
7. Click "Create JIRA ticket"
8. → Pre-filled form. Hit create.
9. → JIRA ticket exists with screenshots attached
10. → Dashboard shows the JIRA link on the selection

**Total user effort: one selection, one comment, one click.** Everything else is automatic.

---

## Open questions for MVP

| Question | Options | Leaning |
|---|---|---|
| Screenshot method | html2canvas / dom-to-image / Canvas API | html2canvas — most mature, handles CSS well |
| Dashboard framework | Hono SSR / Next.js / Vite SPA | Vite SPA — fastest to build, no SSR complexity for a dashboard |
| JIRA auth for MVP | API token hardcoded per workspace | Yes — simplest. OAuth comes later. |
| Where does the dashboard live | Same Cloudflare Worker / separate | Separate — different deploy cadence, different concerns |
| Screenshot upload timing | At capture time / lazy on first dashboard view | At capture time — data should be complete when it arrives |
