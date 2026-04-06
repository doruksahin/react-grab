---
date: '2026-04-06'
references:
- PRD-005
- ADR-0003
- ADR-0006
- SPEC-003
- SPEC-002
- SPEC-006
status: implemented
---

# SPEC-008 Jira assignee and reporter avatar display

## Overview

Extends the existing Jira metadata polling pipeline (established in SPEC-003) to extract and propagate `avatarUrls['48x48']` for the assignee and reporter of each Jira ticket. The avatar URL is surfaced at every layer — sync-server response schema, generated TypeScript types, the in-memory group signal — and rendered as a 24×24 circular image next to the user's display name in the sidebar group card (SPEC-006) and group detail view (SPEC-002). An initials-based fallback renders when the URL is absent or the image fails to load. No new Jira API calls are introduced; the data is already present in the `getIssue` response that the 30-second poller already makes.

## Technical Design

### Layer 1 — sync-server: extract avatar URLs from Jira API response

**File:** `packages/sync-server/src/services/jira.service.ts`

`JiraService.getIssueStatus` already calls `this.client.issues.getIssue` with `fields: ["status", "assignee", "reporter", "labels"]`. The jira.js `Version3Client` types expose `avatarUrls?: AvatarUrls` on both `issue.fields.assignee` and `issue.fields.reporter`, where `AvatarUrls` is `{ '16x16'?: string; '24x24'?: string; '32x32'?: string; '48x48'?: string }`.

Change the return value to include:

```ts
assigneeAvatar: issue.fields.assignee?.avatarUrls?.['48x48'] ?? null,
reporterAvatar: issue.fields.reporter?.avatarUrls?.['48x48'] ?? null,
```

No change to the `getIssue` call itself — the fields list already causes the full user object to be returned.

### Layer 2 — sync-server: Zod schema

**File:** `packages/sync-server/src/schemas/jira.ts`

Add to `JiraTicketStatus`:

```ts
assigneeAvatar: z.string().nullable(),
reporterAvatar: z.string().nullable(),
```

These are non-optional in the schema (always present, may be `null`) to keep consumers simple.

### Layer 3 — generated TypeScript types (react-grab)

**File:** `packages/react-grab/src/generated/sync-api.ts`

`GetJiraTicketStatus200` must gain:

```ts
/** @nullable */
assigneeAvatar: string | null;
/** @nullable */
reporterAvatar: string | null;
```

The generated file is produced by Orval from the OpenAPI spec. After the schema change in Layer 2, run `pnpm orval` (or equivalent) to regenerate. If the team prefers to hand-edit the generated file directly (as has been done for other fields), both approaches are acceptable — the generated file is the source of truth for the frontend type.

### Layer 4 — in-memory group signal

**File:** `packages/react-grab/src/features/sidebar/jira-types.ts`

Add to `SelectionGroupWithJira`:

```ts
/** Avatar URL (48×48) for the Jira assignee, null if unassigned or unavailable */
jiraAssigneeAvatar?: string | null;
/** Avatar URL (48×48) for the Jira reporter, null if unavailable */
jiraReporterAvatar?: string | null;
```

**File:** `packages/react-grab/src/core/index.tsx`

In the `onStatusUpdate` handler, add the two new fields to the group spread:

```ts
jiraAssigneeAvatar: status.assigneeAvatar,
jiraReporterAvatar: status.reporterAvatar,
```

### Layer 5 — rendering: `UserAvatar` component

Create a small shared component (SolidJS) at:

**File:** `packages/react-grab/src/components/sidebar/UserAvatar.tsx`

Props:
```ts
interface UserAvatarProps {
  avatarUrl: string | null | undefined;
  displayName: string | null | undefined;
  size?: number; // defaults to 24
}
```

Behaviour:
- If `avatarUrl` is present: render `<img src={avatarUrl} width={size} height={size} style="border-radius:50%" onError={fallback} />`
- If `avatarUrl` is absent, or `onError` fires: render an initials circle — take the first letter of each space-separated word in `displayName` (up to 2 letters), display in a `<div>` with `border-radius: 50%`, fixed background colour `#64748b` (slate-500), white text.
- If both are absent: render nothing.

**Usage sites:**
- `packages/react-grab/src/components/sidebar/group-card.tsx` — group card component (wherever `jiraAssignee` / `jiraReporter` text is rendered in SPEC-006 group cards)
- `packages/react-grab/src/components/sidebar/detail-header.tsx` — group detail view (wherever assignee/reporter names appear per SPEC-002)

**Explicitly excluded:** `packages/react-grab/src/components/selection-label/jira-meta.tsx` also renders assignee/reporter names, but this is a canvas overlay component — avatars in canvas overlays are out of scope per PRD-005.

Place the `<UserAvatar>` immediately to the left of the display name text, wrapped in a `flex` row with `gap: 6px; align-items: center`.

## Testing Strategy

### Unit — `UserAvatar` component

- Renders `<img>` when `avatarUrl` is provided.
- Renders initials fallback when `avatarUrl` is `null`.
- Renders initials fallback when `avatarUrl` is present but `onError` fires.
- Renders nothing when both `avatarUrl` and `displayName` are null/undefined.
- Initials extraction: `"John Doe"` → `"JD"`, `"Alice"` → `"A"`, `""` → fallback renders nothing or a single placeholder.

### Unit — `JiraService.getIssueStatus`

Extend the existing test (or add a new case) to assert that when the Jira API response includes `assignee.avatarUrls['48x48']` and `reporter.avatarUrls['48x48']`, the returned object contains the correct `assigneeAvatar` and `reporterAvatar` values.

Assert the null path: when `assignee` is `null` (unassigned ticket), `assigneeAvatar` is `null`.

### E2E — `packages/react-grab/e2e/sidebar.spec.ts`

Extend the existing Jira mock route `**/groups/*/jira-status` to include `assigneeAvatar` and `reporterAvatar` in the mock response body.

Assert that after the status poll resolves, the group card contains an `<img>` element with `src` matching the mocked avatar URL.

Assert that when the mock returns `assigneeAvatar: null`, no `<img>` is rendered and an initials element appears instead.

### Lint

`decree lint` must pass with 0 errors after all document changes.

## Acceptance Criteria

### Layer 1 — sync-server service
- [x] `JiraService.getIssueStatus` returns `assigneeAvatar: string | null` extracted from `issue.fields.assignee?.avatarUrls?.['48x48']`
- [x] `JiraService.getIssueStatus` returns `reporterAvatar: string | null` extracted from `issue.fields.reporter?.avatarUrls?.['48x48']`
- [x] When `assignee` is `null` (unassigned), `assigneeAvatar` is `null`
- [x] When `reporter` is `null`, `reporterAvatar` is `null`
- [x] No additional Jira API calls are introduced (verified by test — single `getIssue` call per invocation)

### Layer 2 — Zod schema
- [x] `JiraTicketStatus` schema in `packages/sync-server/src/schemas/jira.ts` includes `assigneeAvatar: z.string().nullable()`
- [x] `JiraTicketStatus` schema includes `reporterAvatar: z.string().nullable()`
- [x] `decree lint` passes with 0 errors

### Layer 3 — generated types
- [x] `GetJiraTicketStatus200` in `packages/react-grab/src/generated/sync-api.ts` includes `assigneeAvatar: string | null`
- [x] `GetJiraTicketStatus200` includes `reporterAvatar: string | null`

### Layer 4 — group signal
- [x] `SelectionGroupWithJira` in `jira-types.ts` includes `jiraAssigneeAvatar?: string | null`
- [x] `SelectionGroupWithJira` includes `jiraReporterAvatar?: string | null`
- [x] `onStatusUpdate` in `core/index.tsx` maps `status.assigneeAvatar` → `jiraAssigneeAvatar` on the group
- [x] `onStatusUpdate` maps `status.reporterAvatar` → `jiraReporterAvatar` on the group

### Layer 5 — UserAvatar component
- [x] `UserAvatar` component exists at `packages/react-grab/src/components/sidebar/UserAvatar.tsx`
- [x] Renders `<img>` with correct `src` when `avatarUrl` is a non-null string
- [x] Renders initials circle when `avatarUrl` is `null`
- [x] Renders initials circle when `<img>` `onError` fires (broken URL)
- [x] Renders nothing when both `avatarUrl` and `displayName` are absent
- [x] Avatar is displayed left of assignee display name in sidebar group cards
- [x] Avatar is displayed left of reporter display name in sidebar group cards
- [x] Avatar is displayed left of assignee display name in group detail view
- [x] Avatar is displayed left of reporter display name in group detail view
- [x] `jira-meta.tsx` (canvas overlay) is NOT modified — out of scope per PRD-005

### Tests
- [x] Unit tests for `UserAvatar` cover: img render, null fallback, error fallback, empty fallback, initials extraction
- [x] Unit test for `getIssueStatus` covers avatar extraction and null assignee path
- [x] E2E test in `sidebar.spec.ts` asserts `<img>` present when mock returns avatar URL
- [x] E2E test asserts initials fallback present when mock returns `assigneeAvatar: null`
