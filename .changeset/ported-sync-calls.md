---
"react-grab": minor
---

Reach the sync server only through two ports

Every server call of the overlay now goes through `StorageAdapter` (comments, groups, screenshots, recordings) or the new `JiraPort` (site, issue types, priorities, labels, ticket status, create ticket, add comment, search users). Port methods take and return plain data and throw on failure, so a browser extension can forward them later (ADR-0023).

- `initSync` accepts optional `storage` and `jira` ports. Without them it builds the HTTP ones from `serverUrl`, `apiToken` and `workspace`, so existing host apps need no change. `apiToken` and `serverUrl` are required only when a port has to be built.
- New entry `react-grab/sync-http` exports `createHttpAdapter` and `createHttpJiraPort` (`{ serverUrl, apiToken, workspace }`) and `SyncHttpError`. It has no Solid and no DOM code.
- `StorageAdapter` gains `loadScreenshot(selectionId, kind)`, and `uploadScreenshot` and `uploadRecording` are now required.
- The generated client no longer keeps the server URL and token in module state; each port carries its own.
- Jira comment images that point at the sync server (`/jira-attachment/…`) show by name instead of as `<img>`, until the Jira port can load attachments.
