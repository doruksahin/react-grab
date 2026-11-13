---
"react-grab": minor
---

Sync writes comments and groups one item at a time

Saving now sends only the comments and groups that changed, one request each, instead of the whole list. Two people on the same workspace can no longer erase each other's comments, and a ticket link can no longer be wiped by another tab — which also closes a path that could create a duplicate Jira ticket.

This needs the matching sync server: the whole-list `PUT /workspaces/:id/comments` and `/groups` routes are replaced by per-item `PUT` and `DELETE` routes. Update the server and the client together.
