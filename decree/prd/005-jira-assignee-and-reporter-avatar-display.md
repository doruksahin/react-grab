---
status: draft
date: 2026-04-06
references: [PRD-004, ADR-0003, ADR-0006]
---

# PRD-005 Jira assignee and reporter avatar display

## Problem Statement

The sidebar group cards show Jira assignee and reporter as plain text display names (e.g. "John Doe"). In a team with many members, text-only names are slow to scan — users must read each name carefully rather than recognising a person at a glance by their profile picture.

The Jira API already returns `avatarUrls` on every user object (assignee, reporter) as part of the `getIssue` response that the sync-server polls every 30 seconds. This data is fetched today but silently discarded — `getIssueStatus` only surfaces `displayName`. Surfacing the avatar URL requires no additional API calls, only extracting and propagating a field we already receive.

## Requirements

### Data layer (sync-server)

- `getIssueStatus` must extract `avatarUrls['48x48']` from the Jira API `assignee` and `reporter` user objects and include them in the response as `assigneeAvatar: string | null` and `reporterAvatar: string | null`.
- The `JiraTicketStatus` Zod schema must be updated to declare both fields as `z.string().nullable()`.
- No additional Jira API calls may be introduced — avatar URLs come from the existing `getIssue` call.

### Generated types and transport (react-grab)

- `GetJiraTicketStatus200` in `src/generated/sync-api.ts` must include `assigneeAvatar: string | null` and `reporterAvatar: string | null`.
- `SelectionGroupWithJira` must include `jiraAssigneeAvatar?: string | null` and `jiraReporterAvatar?: string | null`.
- The `onStatusUpdate` handler in `core/index.tsx` must map the new avatar fields onto the group signal alongside the existing `jiraAssignee` / `jiraReporter` fields.

### Rendering

- Wherever an assignee or reporter display name is shown in the sidebar, a circular avatar image (24 × 24 px) must appear to its left.
- If the avatar URL is absent or null, a fallback must be shown: the user's initials (first letter of each word in the display name) in a coloured circle. The fallback colour may be deterministic (e.g. hashed from the display name) or a single neutral colour.
- Avatar images are loaded directly via `<img src={avatarUrl}>` — the browser's existing Jira session cookies handle authentication for Jira Cloud CDN URLs. No server-side proxying is required.
- Avatars must not block rendering: if the image fails to load, the fallback renders silently (no broken-image icon, no error).

### Scope constraint

- Only the 48 × 48 pixel variant is used. Other sizes (`16x16`, `24x24`, `32x32`) are not stored or transmitted.

## Success Criteria

- A group card with a linked Jira ticket shows a circular avatar image next to the assignee name.
- A group card with a linked Jira ticket shows a circular avatar image next to the reporter name.
- When the Jira user has no avatar (or the URL is null), an initials-based fallback circle is shown — no broken image.
- The avatar image loads without any additional authentication step for users already logged into Jira in their browser.
- No new Jira API endpoint is called — verified by checking network requests during a status poll cycle.
- `decree lint` passes with 0 errors after all document and code changes.

## Scope

**In scope:**
- `assigneeAvatar` and `reporterAvatar` fields in the sync-server response, generated types, and group signal.
- Avatar rendering in the sidebar group card and group detail view.
- Initials fallback when avatar URL is absent or the image fails to load.

**Out of scope:**
- Caching or proxying avatar images server-side.
- Showing avatars in canvas overlays or screenshot captures.
- Avatar display for users on self-hosted Jira instances (behaviour depends on whether their CDN URLs are publicly accessible).
