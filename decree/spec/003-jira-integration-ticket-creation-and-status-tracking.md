---
date: '2026-04-05'
references:
- PRD-002
- ADR-0002
- ADR-0003
- ADR-0004
- ADR-0005
- SPEC-002
status: approved
---

# SPEC-003 JIRA integration — ticket creation and status tracking

## Overview

Implement Phase 3 of PRD-002: JIRA ticket creation and status tracking from the group detail view built in SPEC-002. When a group's status is `open`, the detail view shows a "Create JIRA Ticket" button. Clicking it opens a JIRA create dialog — a modal rendered inside the Shadow DOM — with a searchable project selector, searchable issue type selector, priority selector, auto-generated summary (editable), auto-generated markdown description (editable), and an attachments section listing screenshots that will be attached. On submission the sidebar calls the sync-server's existing JIRA proxy endpoints via Orval-generated fetch functions; the sync-server's `JiraService` creates the ticket, attaches screenshots, and updates the group's `jiraTicketId` in D1. After creation the group transitions to `ticketed` status and the detail view shows a JIRA status banner. While the detail view is open for a ticketed group, the sidebar polls the JIRA status endpoint every 30 seconds; when the ticket reaches the "Done" status category the group transitions to `resolved`.

All overlay rendering (dialog, selects) uses the Kobalte + `<Portal mount={shadowRoot}>` + `forceMount={true}` pattern established in ADR-0005. The sync-server's `JiraService.buildDescription` is updated to use `marklassian` for markdown → ADF conversion per ADR-0004. The sidebar never calls JIRA directly — all JIRA API calls flow through the sync-server proxy per ADR-0003.

## Technical Design

### Architecture: Sidebar → Sync-Server → JIRA (ADR-0003)

```
Browser (sidebar)
  │  createJiraTicket(workspaceId, groupId, body)   [Orval fetch]
  │  listJiraProjects()                              [Orval fetch]
  │  listJiraIssueTypes()                            [Orval fetch]
  │  listJiraPriorities()                            [Orval fetch]
  │  getJiraTicketStatus(workspaceId, groupId)       [Orval fetch, polled every 30s]
  ▼
Sync-server (Hono/Cloudflare Workers)
  │  JiraService (jira.js Version3Client)
  ▼
JIRA REST API v3
```

All five functions already exist in `src/generated/sync-api.ts`. No new codegen needed — run `pnpm codegen` only if the OpenAPI spec changes. The sidebar does not import `jira.js`, `axios`, or any JIRA-specific library.

### sync-server change: `buildDescription` → ADF via `marklassian` (ADR-0004)

The only sync-server change in Phase 3 is fixing `buildDescription` in `packages/sync-server/src/services/jira.service.ts`. The method currently returns a `string`; it must return an ADF `Document` object.

```typescript
// packages/sync-server/src/services/jira.service.ts

import { markdownToADF } from "marklassian"; // ADD

// Change return type from string to object
private buildDescription(
  userDescription: string,
  comments: Array<{ id: string; componentName?: string; elementName: string; tagName: string; commentText?: string; elementSelectors?: string[] }>,
): object {                                  // was: string
  const markdown = [
    userDescription,
    "---",
    "## Selections",
    ...comments.map((c, i) =>
      [
        `### ${i + 1}. ${c.componentName ?? c.elementName} <${c.tagName}>`,
        c.commentText ?? "",
        c.elementSelectors?.[0] ? `Selector: \`${c.elementSelectors[0]}\`` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    "_Created by react-grab_",
  ].join("\n\n");

  return markdownToADF(markdown);            // was: return markdown string
}
```

The incorrect comment `// jira.js auto-converts plain text to ADF` (line 61) is removed. The ADF object is passed directly as `fields.description` in `createIssue` — no change to the call site because `jira.js` accepts `object` there.

Install: `pnpm --filter sync-server add marklassian`

### Status Model

The `SelectionGroup` type already has `jiraTicketId?: string` on the server. Client-side status is derived from the group's data in `features/sidebar/derive-status.ts` (already exists from Phase 1):

```typescript
// features/sidebar/derive-status.ts — extend existing logic
export type GroupStatus = "open" | "ticketed" | "resolved";

export function deriveStatus(group: SelectionGroup): GroupStatus {
  if (!group.jiraTicketId) return "open";
  if (group.jiraResolved) return "resolved";  // NEW field — see below
  return "ticketed";
}
```

`jiraResolved: boolean` is a **client-side signal field** — it does not need a D1 schema change. It is stored on the `SelectionGroup` signal in memory and updated when polling detects `statusCategory === "Done"`. The transition is: sidebar receives a poll response with `statusCategory === "Done"` → sets `jiraResolved = true` on the in-memory group object → `deriveStatus` returns `"resolved"` → status badge updates reactively.

If the app is refreshed, `jiraResolved` is not persisted — the group returns to `ticketed` status until the next poll cycle resolves it again. This is acceptable for Phase 3 (A-012).

### `jiraResolved` field propagation

`SelectionGroup` in `src/generated/sync-api.ts` does not have `jiraResolved`. We add it as a client-only extension in the sidebar feature layer:

```typescript
// features/sidebar/jira-types.ts — NEW
import type { SelectionGroup } from "../../generated/sync-api";

/** Client-only extension — not persisted to server */
export type SelectionGroupWithJira = SelectionGroup & {
  jiraResolved?: boolean;
  jiraStatus?: string;
  jiraStatusCategory?: string;
  jiraUrl?: string;      // stored from createJiraTicket response — used by JiraStatusBanner link
};
```

The `Sidebar` component holds `groups` as `SelectionGroupWithJira[]`. The polling effect mutates (via signal update) the resolved flag on the matching group.

### Sidebar: `GroupDetailView` — JIRA-aware rendering (SPEC-002 extension)

`GroupDetailView` receives one new prop:

```typescript
export interface GroupDetailViewProps {
  group: SelectionGroupWithJira;    // was SelectionGroup
  commentItems: CommentItem[];
  syncServerUrl?: string;
  syncWorkspace?: string;
  onBack: () => void;
  // NEW:
  onTicketCreated: (ticketId: string, ticketUrl: string) => void;
}
```

`onTicketCreated` is called by the JIRA dialog on success. `GroupDetailView` passes the result up to `Sidebar`, which updates the group signal with `jiraTicketId`.

Inside `GroupDetailView`, the footer area below `SelectionList` conditionally renders based on `deriveStatus(props.group)`:

```tsx
<Switch>
  <Match when={deriveStatus(props.group) === "open"}>
    <JiraCreateButton onOpen={() => setDialogOpen(true)} />
  </Match>
  <Match when={deriveStatus(props.group) === "ticketed" || deriveStatus(props.group) === "resolved"}>
    <JiraStatusBanner group={props.group} />
  </Match>
</Switch>
```

### JIRA Create Dialog

The dialog is a Solid component using Kobalte's `Dialog` primitive with the ADR-0005 pattern: `forceMount={true}` + `<Portal mount={shadowRoot}>`.

**Shadow root context:** The shadow root reference is passed through Solid context. The shadow root is created in `mount-root.ts` — `renderer.tsx` does not have a `shadowRoot` variable, and it is not threaded from `core/index.tsx`. The existing codebase pattern (used in `comments-dropdown.tsx:81` and `toolbar/index.tsx:126`) is `containerRef.getRootNode() as ShadowRoot`. The `Sidebar` component itself resolves the shadow root from its own container element:

```typescript
// features/sidebar/shadow-context.ts — NEW
import { createContext, useContext } from "solid-js";

export const ShadowRootContext = createContext<ShadowRoot | null>(null);

export function useShadowRoot(): ShadowRoot | null {
  return useContext(ShadowRootContext);
}
```

In `renderer.tsx`, the `<Sidebar>` is wrapped with the provider. The shadow root value is obtained from the existing `containerRef` (the div inside the shadow root) using the established pattern:

```tsx
// renderer.tsx — existing containerRef, new provider
const shadowRoot = () => containerRef?.getRootNode() as ShadowRoot ?? null;

<ShadowRootContext.Provider value={shadowRoot()}>
  <Sidebar ... />
</ShadowRootContext.Provider>
```

`containerRef` is already available in `renderer.tsx` — it is the root `<div>` rendered into the shadow DOM. `getRootNode()` returns the `ShadowRoot` it is attached to, matching the pattern at `comments-dropdown.tsx:81` and `toolbar/index.tsx:126`.

**Dialog structure:**

```tsx
// components/sidebar/jira-create-dialog.tsx — NEW
import { Dialog } from "@kobalte/core/dialog";
import { Portal } from "solid-js/web";
import { useShadowRoot } from "../../features/sidebar/shadow-context";

export const JiraCreateDialog: Component<JiraCreateDialogProps> = (props) => {
  const shadowRoot = useShadowRoot();

  return (
    <Dialog open={props.open} onOpenChange={props.onClose}>
      <Portal mount={shadowRoot ?? document.body}>
        <Dialog.Content
          forceMount={true}
          disableOutsidePointerEvents={true}  // ADR-0005 Issue #445 workaround
          class="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ "pointer-events": "auto" }}
        >
          <Dialog.Overlay class="absolute inset-0 bg-black/60" style={{ "pointer-events": "auto" }} />
          <div class="relative z-10 bg-[#1a1a1a] rounded-xl w-[480px] max-h-[80vh] overflow-y-auto p-6"
               style={{ "pointer-events": "auto" }}>
            <JiraCreateForm
              workspaceId={props.workspaceId}
              groupId={props.groupId}
              group={props.group}
              onSuccess={props.onTicketCreated}
              onClose={props.onClose}
            />
          </div>
        </Dialog.Content>
      </Portal>
    </Dialog>
  );
};
```

**`@floating-ui/dom` for select positioning:** Searchable selects (project, issue type) use Kobalte's `Combobox` with `forceMount={true}` + `<Portal mount={shadowRoot}>` for the content, and `@floating-ui/dom` with `strategy: 'fixed'` for positioning (ADR-0005, A-020).

### `JiraCreateForm` — Form Fields

```typescript
// State within JiraCreateForm
const [projectKey, setProjectKey] = createSignal("");
const [issueType, setIssueType] = createSignal("");
const [priority, setPriority] = createSignal("Medium");
const [summary, setSummary] = createSignal(defaultSummary(props.group));
const [description, setDescription] = createSignal(defaultDescription(props.group, props.commentItems));
const [submitting, setSubmitting] = createSignal(false);
const [error, setError] = createSignal<string | null>(null);
```

**Auto-generated defaults:**

```typescript
// features/sidebar/jira-defaults.ts — NEW
export function defaultSummary(group: SelectionGroup): string {
  const componentNames = [...new Set(
    group.componentNames ?? []
  )].slice(0, 3).join(", ");
  return componentNames
    ? `${group.name}: ${componentNames}`
    : group.name;
}

export function defaultDescription(
  group: SelectionGroup,
  items: CommentItem[],
): string {
  const lines = [
    `Group: **${group.name}**`,
    "",
    "## Selections",
    ...items.map((item, i) =>
      `${i + 1}. **${item.componentName ?? item.elementName}** \`<${item.tagName}>\`${item.commentText ? ` — ${item.commentText}` : ""}`,
    ),
    "",
    "_Created by react-grab_",
  ];
  return lines.join("\n");
}
```

These produce markdown strings. The sync-server converts them to ADF before calling JIRA (ADR-0004).

**Data loading (Orval-generated functions, wrapped in `createResource`):**

```typescript
const [projects] = createResource(() =>
  listJiraProjects().then((r) => r.data)
);
const [issueTypes] = createResource(() =>
  listJiraIssueTypes().then((r) => r.data)
);
const [priorities] = createResource(() =>
  listJiraPriorities().then((r) => r.data)
);
```

All three load in parallel on dialog open. A `<Suspense>` boundary wraps the form body with a loading skeleton.

**Form fields:**

| Field | Component | Notes |
|---|---|---|
| Project | `Combobox` (Kobalte) | Searchable, options from `listJiraProjects` |
| Issue Type | `Combobox` (Kobalte) | Searchable, options from `listJiraIssueTypes` |
| Priority | `Select` (Kobalte) | Non-searchable, options from `listJiraPriorities`, default "Medium" |
| Summary | `<textarea>` (native) | Pre-filled from `defaultSummary`, 1 row, expandable |
| Description | `<textarea>` (native) | Pre-filled from `defaultDescription`, 6 rows |
| Attachments | Read-only list | Shows filenames of screenshots that will be attached |

**Attachments section (A-016):**

Screenshot attachment is handled server-side by `JiraService` — the sidebar does not upload files. The attachments section is informational only: it lists the screenshots associated with the group's selections.

```tsx
<div class="mt-4">
  <p class="text-[11px] text-white/50 mb-1">Attachments</p>
  <For each={screenshotList()}>
    {(name) => (
      <div class="text-[10px] text-white/40 font-mono">{name}</div>
    )}
  </For>
  <Show when={screenshotList().length === 0}>
    <p class="text-[10px] text-white/30 italic">No screenshots</p>
  </Show>
</div>
```

`screenshotList()` is derived from `props.commentItems` — counts `screenshotElement` and `screenshotFullPage` keys that are present.

**Submission:**

```typescript
async function handleSubmit(e: SubmitEvent) {
  e.preventDefault();
  if (!projectKey() || !issueType()) return;
  setSubmitting(true);
  setError(null);
  try {
    const result = await createJiraTicket(
      props.workspaceId,   // Orval param name: `id` — the workspace ID
      props.groupId,
      {
        projectKey: projectKey(),
        issueType: issueType(),
        priority: priority(),
        summary: summary(),
        description: description(),
      },
    );
    if (result.status === 200) {
      props.onSuccess(result.data.jiraTicketId, result.data.jiraUrl);
      props.onClose();
    } else {
      setError((result.data as { error?: string }).error ?? "Failed to create ticket");
    }
  } catch {
    setError("Network error — check your connection and try again");
  } finally {
    setSubmitting(false);
  }
}
```

**Error states (PRD-002):**
- JIRA auth failure (`500` from server): inline error banner with "Check JIRA configuration" guidance
- Ticket creation failure (`400`): inline error with retry button (re-enables submit)
- Network error: inline error with retry

### `JiraStatusBanner` — Ticketed and Resolved States

```tsx
// components/sidebar/jira-status-banner.tsx — NEW
export const JiraStatusBanner: Component<{ group: SelectionGroupWithJira }> = (props) => {
  const status = () => deriveStatus(props.group);
  return (
    <div class="m-3 p-3 rounded-lg bg-white/5 border border-white/10"
         style={{ "pointer-events": "auto" }}>
      <div class="flex items-center justify-between mb-2">
        <a
          href={props.group.jiraUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="text-[12px] font-semibold text-blue-400 hover:text-blue-300"
        >
          {props.group.jiraTicketId}
        </a>
        <span class="text-[10px] text-white/50">{props.group.jiraStatus ?? "—"}</span>
      </div>
      <JiraProgressDots status={status()} />
    </div>
  );
};
```

**Progress dots** — four dots: created → to do → in progress → done. The active dot is determined by `statusCategory`:

```typescript
function dotIndex(statusCategory: string | undefined): number {
  switch (statusCategory?.toLowerCase()) {
    case "to do": return 1;
    case "in progress": return 2;
    case "done": return 3;
    default: return 0; // "created" / unknown
  }
}
```

The banner reads `jiraStatus` and `jiraStatusCategory` from `props.group` (both on `SelectionGroupWithJira`). These are updated by the polling effect and by `handleTicketCreated`.

### Status Polling

Polling is scoped to `GroupDetailView`'s lifecycle. When the detail view mounts for a `ticketed` group, polling starts. When it unmounts (back navigation), polling stops.

```typescript
// Inside GroupDetailView
onMount(() => {
  if (deriveStatus(props.group) !== "ticketed") return;

  const poll = async () => {
    try {
      const result = await getJiraTicketStatus(props.syncWorkspace!, props.group.id);
      if (result.status === 200) {
        props.onStatusUpdate(result.data);   // bubbles up to Sidebar
      }
    } catch {
      // silent — poll failures do not show errors
    }
  };

  poll(); // immediate first poll
  const id = setInterval(poll, 30_000);
  onCleanup(() => clearInterval(id));
});
```

`props.onStatusUpdate` is a new prop of type `(status: { status: string; statusCategory: string }) => void`. `Sidebar` uses it to update the in-memory group:

```typescript
// Sidebar
function handleStatusUpdate(groupId: string, status: { status: string; statusCategory: string }) {
  setGroups((prev) =>
    prev.map((g) =>
      g.id === groupId
        ? {
            ...g,
            jiraStatus: status.status,
            jiraStatusCategory: status.statusCategory,
            jiraResolved: status.statusCategory.toLowerCase() === "done",
          }
        : g,
    ),
  );
}
```

`setGroups` requires `groups` to be a writable signal in `Sidebar`. Currently `groups` is passed as a prop from `renderer.tsx` (read from the `selectionGroups` signal in `core/index.tsx`). Phase 3 upgrades this: `Sidebar` owns a local `createSignal<SelectionGroupWithJira[]>` that is initialized from `props.groups` and kept in sync with a `createEffect`. This local signal is the one mutated by `handleStatusUpdate` and `handleTicketCreated`.

```typescript
// Sidebar — groups signal
const [groups, setGroups] = createSignal<SelectionGroupWithJira[]>(props.groups);
createEffect(() => {
  // Re-sync if parent updates (new group added via sync)
  setGroups((prev) => {
    const parentIds = new Set(props.groups.map((g) => g.id));
    // Merge: keep jiraResolved/jiraStatus from local state, add new groups from parent
    return props.groups.map((pg) => {
      const local = prev.find((lg) => lg.id === pg.id);
      return local ? { ...pg, jiraResolved: local.jiraResolved, jiraStatus: local.jiraStatus, jiraStatusCategory: local.jiraStatusCategory } : pg;
    });
  });
});
```

### `GroupDetailView` — updated prop signature (full)

```typescript
export interface GroupDetailViewProps {
  group: SelectionGroupWithJira;
  commentItems: CommentItem[];
  syncServerUrl?: string;
  syncWorkspace?: string;
  onBack: () => void;
  onTicketCreated: (groupId: string, ticketId: string, ticketUrl: string) => void;  // NEW
  onStatusUpdate: (groupId: string, status: { status: string; statusCategory: string }) => void;  // NEW
}
```

### Component Tree (Phase 3 additions)

```
Sidebar
├── ShadowRootContext.Provider                      NEW — wraps entire sidebar
├── SidebarHeader                                   unchanged
└── [syncStatus !== "error"]
    ├── [activeDetailGroupId === null]
    │   ├── StatsBar, FilterTabs, GroupList         unchanged
    └── [activeDetailGroupId !== null]
        └── GroupDetailView                         modified
            ├── DetailHeader                        unchanged
            ├── SelectionList                       unchanged
            ├── [status === "open"]
            │   └── JiraCreateButton                NEW
            │       └── JiraCreateDialog            NEW (modal)
            │           ├── Dialog.Overlay          Kobalte + Portal mount
            │           └── JiraCreateForm          NEW
            │               ├── ProjectCombobox     Kobalte Combobox + Portal mount
            │               ├── IssueTypeCombobox   Kobalte Combobox + Portal mount
            │               ├── PrioritySelect      Kobalte Select + Portal mount
            │               ├── SummaryTextarea     native
            │               ├── DescriptionTextarea native
            │               └── AttachmentsSection  read-only list
            └── [status === "ticketed" | "resolved"]
                └── JiraStatusBanner                NEW
                    └── JiraProgressDots            NEW
```

### File Structure

```
packages/react-grab/src/
├── features/
│   └── sidebar/
│       ├── derive-status.ts            modified — add "resolved" branch, use SelectionGroupWithJira
│       ├── jira-types.ts               NEW — SelectionGroupWithJira
│       ├── jira-defaults.ts            NEW — defaultSummary, defaultDescription
│       ├── shadow-context.ts           NEW — ShadowRootContext, useShadowRoot
│       └── index.ts                    updated — export new utilities
├── components/
│   └── sidebar/
│       ├── index.tsx                   modified — local groups signal, ShadowRootContext.Provider, handleTicketCreated, handleStatusUpdate
│       ├── group-detail-view.tsx       modified — Switch for open/ticketed/resolved, onTicketCreated, onStatusUpdate props, polling
│       ├── jira-create-button.tsx      NEW — "Create JIRA Ticket" button
│       ├── jira-create-dialog.tsx      NEW — Kobalte Dialog + Portal mount
│       ├── jira-create-form.tsx        NEW — form fields, submission logic
│       ├── jira-status-banner.tsx      NEW — ticket ID link, status text, progress dots
│       └── jira-progress-dots.tsx      NEW — four-dot progress indicator

packages/sync-server/src/
└── services/
    └── jira.service.ts                 modified — buildDescription returns ADF via marklassian
```

**Dependencies added:**
- `packages/sync-server`: `marklassian` (runtime)
- `packages/react-grab`: `@kobalte/core` (if not already installed), `@floating-ui/dom` (if not already installed)

**Dependencies NOT added:**
- `packages/react-grab`: `jira.js`, `axios`, `marklassian` — none of these belong in the browser bundle

### Pointer-Events Contract (continued from SPEC-002)

All new overlay components must carry `pointer-events: auto` on container elements. This applies to: `JiraCreateDialog` root, `Dialog.Content`, `Dialog.Overlay`, `JiraCreateForm` container, all combobox/select content containers, `JiraStatusBanner`, `JiraProgressDots`.

## Testing Strategy

### sync-server: `buildDescription` → ADF

**Unit tests (`packages/sync-server`):**
- `buildDescription` returns an object (not a string) with `{ version: 1, type: "doc", content: [...] }` shape
- ADF output contains a paragraph node for `userDescription`
- ADF output contains heading nodes for each selection entry
- ADF output contains inline code marks for selector strings
- `buildDescription` with empty comments array returns valid ADF with no selection nodes
- `createIssue` is called with `fields.description` being the ADF object (mock `Version3Client`)

### Sidebar: JIRA Create Dialog

**Unit tests (`packages/react-grab`, vitest + solid-testing-library):**
- `defaultSummary` returns `"GroupName: Comp1, Comp2"` when componentNames present; returns `"GroupName"` when absent
- `defaultDescription` returns markdown with group name, selection list, and footer line
- `JiraCreateButton` renders with label "Create JIRA Ticket"; hidden when group status is not `"open"`
- `JiraCreateForm` renders project, issue type, and priority fields
- `JiraCreateForm` pre-fills summary and description with generated defaults
- `JiraCreateForm` submit button disabled when `projectKey` or `issueType` is empty
- `JiraCreateForm` calls `createJiraTicket` with correct `workspaceId`, `groupId`, and body on submit
- `JiraCreateForm` shows inline error when `createJiraTicket` returns `400`
- `JiraCreateForm` shows inline error on network failure
- `JiraCreateForm` calls `onSuccess` and closes dialog on `200` response
- Attachments section lists screenshot filenames derived from `commentItems` with non-null screenshot keys
- Attachments section shows "No screenshots" when all screenshot keys are null

**Unit tests — status:**
- `deriveStatus` returns `"open"` when `jiraTicketId` is absent
- `deriveStatus` returns `"ticketed"` when `jiraTicketId` present and `jiraResolved` is false/undefined
- `deriveStatus` returns `"resolved"` when `jiraResolved` is true
- `JiraStatusBanner` renders ticket ID as a link with `href` containing the ticket ID
- `JiraStatusBanner` renders the status text from `group.jiraStatus`
- `JiraProgressDots` highlights dot at index 0 when `statusCategory` is undefined
- `JiraProgressDots` highlights dot at index 2 when `statusCategory` is "In Progress"
- `JiraProgressDots` highlights dot at index 3 when `statusCategory` is "Done"

**Integration tests:**
- Clicking "Create JIRA Ticket" button opens the dialog
- Dialog renders inside the shadow root (not on `document.body`) — assert `document.body` contains no dialog content
- Project combobox filters options as user types
- Submitting the form with valid fields calls `createJiraTicket`, closes dialog, and transitions group status to `ticketed`
- `JiraStatusBanner` appears after ticket creation
- After `onStatusUpdate` is called with `statusCategory: "Done"`, status badge shows `"resolved"` and progress dots are fully filled
- Polling: `getJiraTicketStatus` is called after 30 seconds of detail view being open (mock `setInterval`)
- Polling stops when detail view unmounts (back navigation)

**Playwright e2e:**
- "Create JIRA Ticket" button is clickable (pointer-events contract)
- Dialog overlay is clickable (dismiss does not fire immediately — Issue #445 workaround in effect)
- Project combobox dropdown renders inside shadow root
- Ticket ID link in status banner opens in new tab (`target="_blank"`)

### Manual Verification (Phase 3 checkpoint, PRD-002)

- End-to-end: create a JIRA ticket from the sidebar — project selector populates from real JIRA, ticket is created, ID appears in banner
- Description arrives in JIRA as formatted ADF (not plain text) — verify in JIRA UI
- Screenshots are attached to the JIRA ticket — verify in JIRA attachments section
- Auth failure (wrong API token): inline error with guidance shown, no crash
- Ticket creation failure (invalid project key): inline error with retry shown
- Progress dots advance as JIRA ticket status changes — verified by manually moving ticket in JIRA and waiting ≤60s for next poll

## Acceptance Criteria

- [ ] `marklassian` installed in `packages/sync-server`; `buildDescription` returns ADF object; incorrect `jira.js auto-converts` comment removed (ADR-0004)
- [ ] ADF object passed as `fields.description` in `createIssue` — no string description sent to JIRA v3 API
- [ ] `SelectionGroupWithJira` type defined in `features/sidebar/jira-types.ts` with `jiraResolved?: boolean`, `jiraStatus?: string`, `jiraStatusCategory?: string`, `jiraUrl?: string`
- [ ] `ShadowRootContext` created in `features/sidebar/shadow-context.ts`; `renderer.tsx` resolves shadow root via `containerRef.getRootNode() as ShadowRoot` and wraps `<Sidebar>` in `<ShadowRootContext.Provider value={shadowRoot()}>`
- [ ] `Sidebar` owns a local `createSignal<SelectionGroupWithJira[]>` for groups; synced from `props.groups` via `createEffect` (preserving local jira fields)
- [ ] `GroupDetailView` renders `JiraCreateButton` when `deriveStatus(group) === "open"` (PRD-002)
- [ ] `GroupDetailView` renders `JiraStatusBanner` when status is `"ticketed"` or `"resolved"` (PRD-002)
- [ ] `JiraCreateDialog` opens on button click; uses `Dialog` from `@kobalte/core` with `forceMount={true}` + `<Portal mount={shadowRoot}>` (ADR-0005)
- [ ] `disableOutsidePointerEvents={true}` applied on `Dialog.Content` (ADR-0005 Issue #445 workaround)
- [ ] Project selector: `Combobox` with `forceMount={true}` + `<Portal mount={shadowRoot}>`; filters options as user types
- [ ] Issue type selector: `Combobox` with `forceMount={true}` + `<Portal mount={shadowRoot}>`; filters options as user types
- [ ] Priority selector: `Select` with `forceMount={true}` + `<Portal mount={shadowRoot}>`; defaults to "Medium"
- [ ] Summary field pre-filled with `defaultSummary(group)`; user-editable
- [ ] Description field pre-filled with `defaultDescription(group, commentItems)`; user-editable
- [ ] Attachments section lists screenshot filenames for all selections with non-null screenshot keys; shows "No screenshots" when none (A-016)
- [ ] Submit calls `createJiraTicket(workspaceId, groupId, body)` via Orval-generated function (ADR-0003)
- [ ] Submit button disabled when `projectKey` or `issueType` is empty
- [ ] On `200`: dialog closes, `onTicketCreated` fires with `jiraTicketId` and `jiraUrl`; both stored on in-memory group; group transitions to `ticketed`, `JiraStatusBanner` appears with correct link
- [ ] On `400`: inline error with retry (form stays open, submit re-enabled)
- [ ] On network error: inline error with retry
- [ ] `JiraStatusBanner` shows ticket ID as link to JIRA (`target="_blank"`), current status text (PRD-002)
- [ ] `JiraProgressDots` shows four dots: created → to do → in progress → done; active dot highlighted (PRD-002)
- [ ] `deriveStatus` returns `"resolved"` when `jiraResolved === true`; badge updates reactively
- [ ] Polling: `getJiraTicketStatus` called immediately on `GroupDetailView` mount for `ticketed` groups, then every 30 seconds (PRD-002)
- [ ] Polling stops on `GroupDetailView` unmount (`clearInterval` in `onCleanup`)
- [ ] `statusCategory === "done"` (case-insensitive) sets `jiraResolved = true` on in-memory group (A-012)
- [ ] All new container elements carry `pointer-events: auto` (SPEC-002 contract)
- [ ] Dialog content renders inside shadow root — `document.body` contains no dialog markup (ADR-0005)
- [ ] `defaultSummary` and `defaultDescription` exported from `features/sidebar/jira-defaults.ts`
- [ ] `ShadowRootContext`, `useShadowRoot` exported from `features/sidebar/shadow-context.ts`
- [ ] `SelectionGroupWithJira` exported from `features/sidebar/jira-types.ts`
- [ ] Unit tests pass for `buildDescription` ADF output, `defaultSummary`, `defaultDescription`, `deriveStatus`, `JiraProgressDots` dot index, `JiraCreateForm` submit/error paths
- [ ] Integration tests pass: dialog open/close, form submission, status transition, polling lifecycle
- [ ] `decree lint` passes with zero errors

### Deferred (Phase 4+)

- [ ] Focus trapping inside JIRA dialog (Phase 4 — `solid-focus-trap`)
- [ ] `aria-modal="true"` on dialog for screen reader isolation (Phase 4)
- [ ] Keyboard navigation in project/issue-type comboboxes beyond Kobalte defaults (Phase 4)
- [ ] Kobalte Issue #445 workaround removal when upstream fix is released (ongoing)
- [ ] Persist `jiraResolved` to D1 so refresh does not reset to `ticketed` (Phase 4+)
- [ ] JIRA status polling for `resolved` groups (currently polling stops at `open`/`ticketed`) — re-evaluate if polling `resolved` groups is needed
