---
"react-grab": minor
---

A group with a Jira ticket can be archived instead of deleted (ADR-0030): from a comment's ⋯ menu ("Archive", or "Archive group (N comments)" when the ticket is a group's) or from the group's header. Archived groups leave the comments menu, the page, Copy all and the sidebar's list, and stay in a closed "Archived" section at the end of the sidebar, where "Restore" brings them back. A notification offers Undo right after archiving. The sync server gains `PUT`/`DELETE /workspaces/{id}/groups/{groupId}/archive` and a server-owned `archivedAt` on groups; apply the migration before deploying the Worker.
