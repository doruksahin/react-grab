---
date: '2026-11-17'
references:
- ADR-0008
- ADR-0019
- ADR-0028
status: accepted
---

# ADR-0030 Archive a ticketed group

## Context and Problem Statement

A selection with a Jira ticket cannot be removed (ADR-0008): the ticket keeps it. Once the work is done, those selections still fill the comments menu, the pins on the page and the sidebar. People want them out of the way without losing the ticket, its comments or its history, and want to bring them back when needed.

A ticket belongs to a group. A loose selection with its own ticket sits alone in a hidden synthetic group (ADR-0008). So "archive this selection" and "archive this group" are the same act on a group.

## Considered Options

1. **An "Archived" group that selections move into.** Matches the words "archive is a kind of group", but moving cuts a selection off its ticket, and ticketed selections may not move (ADR-0008).
2. **A new value of the group's `status`** (it already has an unused `resolved`). `status` is the ticket's lifecycle; an archived group still has its ticket, so one field would carry two meanings and lose "ticketed" on restore.
3. **An `archivedAt` time on the group, owned by the server.** Groups and selections stay where they are; views leave archived groups out; the sidebar shows them in one "Archived" section.

## Decision Outcome

Chosen option: **3**, by the user on 2026-11-17 (plan "Arşiv Planı"), with every recommended answer.

- **What can be archived:** a group with a ticket, real or synthetic. A group without a ticket is deleted instead, as before. The server refuses to archive one (409).
- **Server-owned field.** `groups.archived_at` (epoch ms, null when active). `PUT /workspaces/{id}/groups/{groupId}/archive` sets it to the server's time; `DELETE` on the same path clears it. It is not in the group write schema, so a stale client upsert cannot restore or archive a group (ADR-0019).
- **One rule in the domain.** `features/selection-groups/business/archive-policy.ts`: whether a group is archived, whether it can be, and which group archiving a selection archives (its own, when that group has the ticket).
- **Where archived groups show.** Not in the comments menu, not as pins or labels on the page, not in Copy all, not in the sidebar's main list or its status chips. The sidebar ends with a closed "Archived" section holding them (their rows and cards, search included). The Jira poll skips them.
- **Actions.** "Archive" on a loose ticketed selection's menu; "Archive group (N comments)" on a selection in a ticketed group and on the group's header, since the ticket is the group's. "Restore" in the Archived section. After archiving, a short notification offers Undo (Kobalte Toast).
- **Not now:** archiving when the Jira ticket closes. It can come later as an option ("after N days", as Linear does).

### Consequences

- Good: the board shows only work in progress; nothing is lost, and Restore puts everything back because the ticket link never changed.
- Good: fewer Jira calls; archived tickets are not polled.
- Neutral: the unused `resolved` status stays as it is; removing it is a separate change.
- Bad: one more server route pair and port method; each surface that lists selections has to leave archived groups out. `selectionTree` does this once for the comments menu and the sidebar.

### Rollout

Apply the migration to production before deploying the Worker, then release the overlay and the extension.

## More Information

Linear and GitHub Projects archive the same way: an archived item keeps its context, leaves the normal views, is browsed in a separate place and can be restored ([Linear](https://linear.app/docs/archive-issues), [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/managing-items-in-your-project/archiving-items-from-your-project)).
