# Selection Label — Stats-Bar Card Parity (Design)

Date: 2026-04-16
Status: Approved (Option 1 — Full parity)
POCs: `poc-stats-bar.html`, `poc-selection-label.html`

## Goal

Make the expanded/ticketed **selection label** render the same card body as the sidebar's selection list item. One component, two contexts.

## Non-goals

- The **prompt-mode** label (textarea + group picker + create-ticket CTA) stays as-is. The unified card body only applies when the label is showing a ticketed selection.
- No new JIRA fields. Everything rendered is already in `SelectionGroupWithJira` / `CommentItem`.
- No changes to the sidebar card's data contract or layout.

## Current state

The sidebar card is inlined in `packages/react-grab/src/components/sidebar/selection-list-tab.tsx:116-281` — ~165 lines of JSX rendering 7 rows:

1. JIRA status pill (absolute top-right) — or `"no ticket"`
2. Summary text (comment text ▸ component name ▸ tag name)
3. Labels chips row (JIRA labels)
4. Date range row (relative timestamp → JIRA due date)
5. Screenshot row (element + full page thumbs)
6. Bottom meta row (issue type icon, jira key, priority icon, assignee)
7. Comments section (already unified via `CommentsSection`)

The selection label (`components/selection-label/index.tsx`) currently renders a leaner version in its `BottomSection`:

- `JiraMeta` — one-line ticket + status + assignee/reporter + labels
- `CommentsSection`

Missing from the label today: summary row, rich date row, screenshots, priority + issue-type icons.

## Architecture

Extract the inlined card body into a new component owned by the sidebar feature:

```
components/sidebar/
  selection-card-body.tsx    ← NEW — the 7-row stats-bar block
  selection-list-tab.tsx     ← consumes <SelectionCardBody>
```

```
components/selection-label/
  index.tsx                  ← consumes <SelectionCardBody> when isPromptMode=false
                                and props.jiraTicketId is set
```

### `SelectionCardBody` props

One shape — both call sites flatten their data into it. Keep props flat; no nested `item` / `group` objects, so the same component works with the selection-label's top-level props without a translation layer.

```ts
interface SelectionCardBodyProps {
  // Status pill (top-right, absolute)
  jiraTicketId?: string;
  jiraStatus?: string;
  jiraStatusCategory?: string;

  // Summary row
  summary: string;

  // Labels row
  jiraLabels?: string[];

  // Date row
  timestamp: number;              // relative time
  jiraDueDate?: string | null;    // absolute due date

  // Screenshot row
  itemId: string;                 // used to build screenshotUrl
  hasElementScreenshot?: boolean;
  hasFullPageScreenshot?: boolean;
  syncServerUrl?: string;
  syncWorkspace?: string;

  // Bottom meta row
  jiraIssueType?: string;
  jiraPriority?: string;
  jiraAssignee?: string;
  jiraAssigneeAvatar?: string | null;

  // Comments — owned by caller, passed through
  jiraComments?: JiraComment[];
  onSubmitComment?: SubmitCommentFn;
  onSearchUsers?: SearchJiraUsersFn;
  onRefreshStatus?: () => void;
}
```

Component lives in `components/sidebar/` because the sidebar is the primary consumer and the "stats-bar card" concept is a sidebar idea that the label is adopting — not a shared primitive like `<Button>`. No promotion to `components/ui/` until a third consumer appears.

### Label composition

The selection label header stays — `TagBadge` + `FlagIndicator` + collapse chevron. Below the header, when the selection is ticketed and the label is expanded, render `<SelectionCardBody>` instead of the current `JiraMeta` + bare `CommentsSection`.

```
<SelectionLabel>
  <Arrow />                                ← unchanged
  <Panel>
    ┌─ Header row ─────────────────────┐
    │  FlagIndicator · TagBadge · ▾    │  ← unchanged
    └──────────────────────────────────┘
    ┌─ Ticketed + expanded ────────────┐
    │                                  │
    │  <SelectionCardBody .../>        │  ← NEW. replaces JiraMeta + Comments
    │                                  │
    └──────────────────────────────────┘
    ┌─ Prompt mode ────────────────────┐
    │  ActiveGroupPicker               │  ← unchanged
    │  CreateTicketButton              │
    │  Textarea + submit               │
    │  CommentsSection                 │  ← stays until we add ticket data here
    └──────────────────────────────────┘
  </Panel>
</SelectionLabel>
```

### Data flow

Sidebar call site:

```tsx
<SelectionCardBody
  summary={item.commentText ?? item.componentName ?? item.tagName}
  timestamp={item.timestamp}
  itemId={item.id}
  hasElementScreenshot={Boolean(item.screenshotElement)}
  hasFullPageScreenshot={Boolean(item.screenshotFullPage)}
  syncServerUrl={syncServerUrl}
  syncWorkspace={syncWorkspace}
  jiraTicketId={group()?.jiraTicketId}
  jiraStatus={group()?.jiraStatus}
  jiraStatusCategory={group()?.jiraStatusCategory}
  jiraLabels={group()?.jiraLabels}
  jiraDueDate={group()?.jiraDueDate}
  jiraIssueType={group()?.jiraIssueType}
  jiraPriority={group()?.jiraPriority}
  jiraAssignee={group()?.jiraAssignee}
  jiraAssigneeAvatar={group()?.jiraAssigneeAvatar}
  jiraComments={group()?.jiraComments}
  onSubmitComment={...bindGroupCommentCallbacks(...)}
/>
```

Selection-label call site — maps directly from `SelectionLabelProps` (already flat):

```tsx
<SelectionCardBody
  summary={props.jiraSummary ?? tagDisplayResult().componentName ?? props.tagName}
  timestamp={props.timestamp}
  itemId={props.itemId}
  hasElementScreenshot={Boolean(props.hasElementScreenshot)}
  hasFullPageScreenshot={Boolean(props.hasFullPageScreenshot)}
  syncServerUrl={props.syncServerUrl}
  syncWorkspace={props.syncWorkspace}
  jiraTicketId={props.jiraTicketId}
  jiraStatus={props.groupStatus}
  jiraStatusCategory={props.jiraStatusCategory}
  jiraLabels={props.jiraLabels}
  jiraDueDate={props.jiraDueDate}
  jiraIssueType={props.jiraIssueType}
  jiraPriority={props.jiraPriority}
  jiraAssignee={props.jiraAssignee}
  jiraAssigneeAvatar={props.jiraAssigneeAvatar}
  jiraComments={props.jiraComments}
  onSubmitComment={props.onSubmitJiraComment}
  onSearchUsers={props.onSearchJiraUsers}
  onRefreshStatus={() => props.onRefreshJiraStatus?.()}
/>
```

### New props on `SelectionLabelProps` / `SelectionLabelInstance`

The renderer already passes most of this. What needs to flow through that isn't there today:

- `jiraSummary` — the JIRA ticket summary text (group-level field). Needed for the summary row.
- `jiraDueDate` — already in `SelectionGroupWithJira`, plumb through.
- `jiraIssueType` — already in `SelectionGroupWithJira`, plumb through.
- `jiraPriority` — already in `SelectionGroupWithJira`, plumb through.
- `jiraStatusCategory` — already in `SelectionGroupWithJira`, plumb through (drives pill color).
- `timestamp`, `itemId`, `hasElementScreenshot`, `hasFullPageScreenshot` — come from the `CommentItem` backing the label's current selection.
- `syncServerUrl`, `syncWorkspace` — already plumbed to some label features; confirm or add.

## Edge cases

- **No ticket** — `jiraTicketId` absent. In prompt mode the label already has the Create Ticket CTA; we don't render the card body. For expanded-non-prompt-no-ticket the label shouldn't hit this path (the expand is only offered for ticketed items), but if it can, `SelectionCardBody` will render the `"no ticket"` pill + `"no ticket"` meta placeholder the sidebar already uses.
- **No screenshots** — the row is hidden (existing sidebar behavior).
- **No due date** — renders `"No due date"` italic placeholder (existing sidebar behavior).
- **Label width** — `SelectionCardBody` is layout-agnostic; the label popover already sizes itself from content + has max-width clamping via `panelWidth()`. Confirm the stats-bar card fits within the existing label footprint on measurement; tighten padding if needed.

## Testing

- Existing sidebar tests tagged `@SPEC-004`, `@SPEC-010`, `@SPEC-013` must keep passing — the refactor moves code but keeps output identical at the sidebar call site.
- Update `jira-selection-label-visual.spec.ts` (`@SPEC-010`) snapshots to the new card layout.
- Visual spec for the new label: same screenshot pair as `jira-selection-label-visual.spec.ts` at several states (ticketed/done, ticketed/in-progress, flagged).
- Unit test `SelectionCardBody` in isolation? Skip — it's pure presentation, no business logic. Visual tests cover it.

## Rollout

Single PR. No flag, no migration. The sidebar refactor and label adoption ship together so the extracted component has two call sites from day one.
