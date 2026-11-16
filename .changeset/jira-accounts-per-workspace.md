---
"react-grab": minor
---

Jira accounts per workspace (ADR-0027)

The sync server now decides where a workspace's tickets go: each workspace is bound to a Jira account and project, set up in the extension's settings. A host app names only the workspace.

- **Breaking:** `SyncConfig.jiraProjectKey` is removed. A workspace without a Jira destination cannot create tickets; choose its account and project in the extension's settings.
- **Breaking:** `JiraPort.getSite` is replaced by `getDestination`, which returns `{ siteUrl, projectKey, signsInAs }`. `listIssueTypes`, `listLabels` and `searchUsers` take no project key, and `JiraTicketDraft` has no `projectKey`.
- The Jira routes are workspace-scoped (`/workspaces/{id}/jira/…`); the old `/jira/…` routes are removed. A failed Jira request throws a `SyncHttpError` with a `code` (for example `jira-account-rejected`, `jira-destination-missing`), and the create-ticket dialog shows the reason and keeps Create disabled.
- The create-ticket dialog names the account: "Into SCRUM on acme.atlassian.net, as Ada".
- Release note: give every workspace a Jira destination before upgrading. The sync server no longer has a Jira account of its own.
- `react-grab/sync-http` exports `createHttpJiraAdminPort`, for the extension's service worker only; it needs the admin token.
