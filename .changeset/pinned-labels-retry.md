---
"react-grab": minor
"@react-grab/sync-server": minor
---

Saved comments as pins, new UI primitives, and a sync Retry that works (ADR-0022)

Saved comments now show on the page as one-line pins (status dot, ticket key, first words) instead of open panels. A pin opens a card with the latest comment; "Open thread" opens the sidebar on that selection, where the Jira thread and its editor now live. Pass `collapsibleLabels: false` to keep the old open labels without pins, or `labelsStartCollapsed: false` to keep pins with their cards open.

The overlay's look now comes from shared primitives (Button, IconButton, Badge, StatusChip, ToggleGroup, Tabs, Alert, Textarea, Pin) on the design-system tokens. The sidebar's stats block is replaced by status chips that filter the groups. When the sync server cannot be reached, an inline banner offers Retry, which connects again and sends the changes made while offline. The comment composer and the Jira create dialog are laid out again: the dialog puts the summary first, starting from the comment, names where the ticket goes and previews the description.

The sync server adds `GET /jira/site`, which returns the configured Jira site so the dialog can name it. A Worker deployed before this change answers 404 and the dialog names the project only.
