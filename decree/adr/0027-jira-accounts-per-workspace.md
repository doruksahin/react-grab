---
date: '2026-11-16'
references:
- ADR-0018
- ADR-0019
- ADR-0020
- ADR-0023
status: accepted
---

# ADR-0027 Jira accounts per workspace, set up in the extension

## Context and Problem Statement

The sync server knows one Jira site and one account: `JIRA_BASE_URL`, `JIRA_EMAIL` and `JIRA_API_TOKEN` in the Worker's environment (ADR-0018). Every ticket from every workspace lands on that site, created by that account. The project key comes from the client: from the extension's site settings (the gateway writes it into each call, `bind-site-jira-project.ts`), or from `initSync({ jiraProjectKey })` in a host app.

We want two apps to send tickets to two different Jira sites with two different accounts. For example, one app sends to `doruksahin.atlassian.net` and another to `appier.atlassian.net`. The person setting this up should enter it in the UI, not in Worker configuration. A teammate or an app should only choose the workspace. The site, account and project should come with the workspace, and the account's secret should never leave the server.

How are Jira accounts entered, kept and chosen per workspace?

## Considered Options

1. **Named accounts in one Worker secret.** A Zod-validated JSON secret `JIRA_CONNECTIONS` holds `{ name: { baseUrl, email, apiToken } }`, and workspaces map to a name. It needs little code, but there is no UI: adding an account is `wrangler secret put`, which deploys a new Worker version.
2. **Accounts entered in the extension's settings and stored on the server, with the API token encrypted.** The server verifies the account with Jira before saving it, and binds each workspace to an account and a project.
3. **"Sign in with Atlassian" (OAuth 2.0 3LO) now.** This is Atlassian's recommended flow for external apps, and tickets carry the name of the person who connected. It needs an app registered at Atlassian, a callback route, and storage that keeps up with rotating refresh tokens.
4. **Accounts kept in each browser's extension storage and sent with each request.** Host apps could not share them, every browser would hold a copy of the token, and teammates' setups would drift apart.

## Decision Outcome

Chosen option: **2**. It keeps option 3 open: an OAuth credential is a second credential kind in the same model, added later behind a second button on the same form.

### User flow

The flow is designed in the "Jira Accounts per Workspace" artifact. Everything is entered on the extension's settings page, which already holds the sync server and the sites.

1. **Add a Jira account, once per account.** You enter the site, email and API token, then press **Connect**. The server signs in to Jira (`GET /rest/api/3/myself`) before saving. The list shows the site, the person the account signs in as, and how many workspaces use it. The token is write-only: it can be replaced, never read back.
2. **Enable a site and choose its workspace.** In the existing form, the workspace field becomes a choice of the server's workspaces, plus **New workspace…**.
   - A new workspace is named in place, then bound to a Jira account and one of its projects. The project list comes live from that Jira site.
   - An existing workspace shows where its tickets go, read-only. It is changed in the workspaces table.
   - The site settings lose their Jira project key.
3. **Create a ticket.** The overlay's dialog shows "Into SCRUM on doruksahin.atlassian.net, as Doruk Şahin". When Jira rejects the account, or the workspace has no destination, the dialog says so, points to the settings, and keeps **Create** disabled.
4. **Host apps** name only the workspace: `initSync({ workspace })`. `jiraProjectKey` is deprecated in the next minor version, with a console warning, and removed in the next major version.

Decisions taken with the user's approval of the flow (2026-11-16):
- Accounts are added by API token for now.
- Setup happens in the extension's settings.
- Tickets are created as the account's owner. A shared bot account per Jira site is the alternative, if personal names should stay off tickets.

### Domain model (server, "Jira integration" context)

| Concept | What it is | Invariants |
|---|---|---|
| `JiraAccount` (aggregate) | `id`, `siteUrl`, `email`, Jira `accountId`, `displayName`, `credential` | Verified with Jira before it is saved. One account per site and Jira `accountId`. The credential never leaves the server. Cannot be removed while a workspace binding or a ticket refers to it (foreign keys with `ON DELETE RESTRICT`, mapped to 409). |
| `JiraCredential` (value) | A discriminated union. Today only `{ kind: "api-token", token }`; `{ kind: "oauth", refreshToken, cloudId }` comes later. | Stored only encrypted. |
| `Workspace` (aggregate) | `id`, and its optional Jira destination `{ jiraAccountId, projectKey }` | The project exists in the account when it is bound. At most one destination. It decides where **new** tickets go. |
| Ticket origin (on the group) | `jiraAccountId` next to the existing `jiraTicketId` | Set when the ticket is created, never changed. **A ticket is always read and commented on through the account that created it**, whatever the workspace is bound to now. |

The ticket origin is needed because a group stores only the issue key (`groups.jira_ticket_id`). Without it, a rebound workspace would read old tickets through the new account: they would fail, or a key like `SCRUM-1` that exists on both sites would read or comment on someone else's issue. With it, rebinding a workspace is safe and changes only new tickets.

The workspace becomes a stored entity, the `workspaces` table. Until now it was only the `workspace_id` string on groups and comments.

### Server design (layers per `packages/sync-server/CLAUDE.md`)

Each piece has one job:

| Piece | Layer | Job |
|---|---|---|
| `schemas/jira-account.ts`, `schemas/workspace.ts` | Schemas | Zod schemas, the source of truth for the routes and the generated clients (Zod → OpenAPI → Orval) |
| `services/credential-vault.ts` | Service | Encrypt and decrypt a credential; nothing else |
| `services/jira-account.service.ts` | Service | Add, verify, replace the credential of, and remove an account |
| `services/workspace.service.ts` | Service | Create a workspace; set and clear its destination; check that the project exists in the account; give the destination with `signsInAs` |
| `services/jira-client-factory.ts` | Service | Build a `JiraService` for one account: for a workspace's destination (new tickets, pickers) or for a group's ticket origin (status, comments, attachments) |
| `services/jira-errors.ts` | Service | Map Jira and binding failures to one typed error set, used by every Jira route instead of per-route mapping |
| `repositories/jira-accounts.repo.ts`, `repositories/workspaces.repo.ts` | Repository | D1 through Drizzle; no business rules |

The routes ask the factory for a `JiraService` only when they need one. `inject-repos.ts` gives them the factory, not a built service, so other requests do not decrypt anything.

`JiraService` keeps its Jira calls. It receives `{ siteUrl, email, apiToken }` for one account instead of reading the environment. `getSite` leaves it: the destination belongs to the workspace, so `workspace.service.ts` builds it from the binding and the account.

### Credentials at rest

- **Encryption:** AES-256-GCM with the Web Crypto API (`crypto.subtle`), which the Workers runtime implements. No library is added.
  - Each write uses a new random 96-bit IV.
  - The additional authenticated data is the account id, the key version and the credential kind, so a ciphertext cannot be moved to another row or read as another kind.
- **Keys:** a Worker secret `JIRA_CREDENTIAL_KEYS`, a JSON key ring `{ "<version>": "<32 random bytes, base64>" }`, and a plain variable `JIRA_CREDENTIAL_KEY_CURRENT` naming the version used for writes. Both are validated by the env schema, as in ADR-0018. Each row stores its `key_version`.
  - To rotate: add a version to the ring, make it current, call `POST /jira-accounts/reencrypt` with the admin token (it seals every row of an older version again through the vault), then remove the old version.
- **Why not Worker secrets per account:** Worker secrets are bound when the Worker is deployed. The Worker cannot add one at runtime from a form. This is why option 1 has no UI.

### Site URL

The account's site must be `https://<name>.atlassian.net`. The Zod schema enforces it and normalizes the value to that origin, so the Worker sends an account's credential only to that origin. The verification call (`/rest/api/3/myself`) is made with `redirect: "manual"`, so a typed URL cannot redirect the credential to another host before the account is saved. This ADR covers Jira Cloud (REST v3) only. Self-hosted Jira would need a new ADR.

### API (added to the existing OpenAPI chain)

Account management and destination routes (admin):

| Route | Purpose |
|---|---|
| `GET /jira-accounts` | Site, display name, email and usage per account. No credential. |
| `POST /jira-accounts` | `{ siteUrl, email, apiToken }`. Verifies with Jira, then saves. 422 with Jira's reason when Jira rejects it; 409 when the same Jira user on the same site is already added. |
| `PUT /jira-accounts/{accountId}/credential` | Replaces the token, after verifying it is the same Jira user |
| `DELETE /jira-accounts/{accountId}` | 409 while a workspace or a ticket refers to it |
| `GET /jira-accounts/{accountId}/projects` | Projects for the picker |
| `PUT /workspaces/{id}/jira` | `{ jiraAccountId, projectKey }`. 422 when the project is not in the account. |
| `DELETE /workspaces/{id}/jira` | Clears the destination; tickets already made keep their origin |

Everyday routes (sync token):

| Route | Purpose |
|---|---|
| `GET /workspaces` | Workspaces with their destination, for the picker |
| `PUT /workspaces/{id}` | Creates the workspace if it does not exist (per-item writes, ADR-0019) |
| `GET /workspaces/{id}/jira` | Destination: `siteUrl`, `projectKey`, `signsInAs`. Replaces `GET /jira/site`. |

The picker routes `/jira/projects`, `/jira/issue-types`, `/jira/priorities`, `/jira/labels` and `/jira/users` move under `/workspaces/{id}/jira/` and use the workspace's destination. The project key comes from the destination: the client no longer sends it. Ticket creation (`/workspaces/{id}/groups/{groupId}/jira-ticket`) uses the destination and writes the ticket origin. Status and comments (`…/jira-status`, `…/jira-comment`) use the ticket origin. The attachment proxy `GET /jira-attachment/{attachmentId}` has no workspace today, so it moves to `/workspaces/{id}/groups/{groupId}/jira-attachments/{attachmentId}` and uses the ticket origin.

Errors, from `jira-errors.ts`:

| Case | Answer |
|---|---|
| Jira rejects the account (401) | 502, `code: "jira-account-rejected"` |
| The account lost access to the project (403) | 502, `code: "jira-project-forbidden"` |
| The workspace has no destination | 409, `code: "jira-destination-missing"` |

The client turns each code into one of the dialog's states.

### Access

ADR-0020 gives every caller one sync token, and host apps keep it in page JavaScript through `.env.local`. With that token alone, any script on a host app's dev page could add accounts and redirect a workspace's tickets. Today the token can only file tickets. So the admin routes above need a second token, `SYNC_ADMIN_TOKEN`, checked by Hono's `bearerAuth` on an admin sub-router, the same middleware `access-control.ts` uses for the sync token.

- The admin token is entered on the extension's settings page, next to the sync token. Only the service worker reads it, as for the sync token (ADR-0023). The dashboard proxy may hold it too.
- In the extension, the admin requests travel on the settings messenger. The gateway accepts them only from the extension's own pages (`assertExtensionPageSender`), never from a content script.
- The overlay and host apps never hold the admin token. The overlay's ports gain no management methods. `JiraPort.getSite` becomes `getDestination`, which adds `signsInAs`. Its project parameters are removed.

### Rollout

Each step is reviewed for SRP, DRY and layers, and the findings are fixed, before the next step starts.

1. **Server.** Add the tables and columns (Drizzle migration), the vault, the services, the error mapper, the admin router and the routes, and regenerate the clients. The old routes stay, so the current overlay and extension keep working.
   - The migration fills `workspaces` with `SELECT DISTINCT workspace_id` from groups and comments, so existing workspaces appear in the picker.
   - A workspace without a destination falls back to the environment account and still takes the client's project key. A ticket without an origin is read through the environment account.
   - Release order: migration, then the `JIRA_CREDENTIAL_KEYS`, `JIRA_CREDENTIAL_KEY_CURRENT` and `SYNC_ADMIN_TOKEN` secrets, then the Worker.
   - A workspace first written by the old Worker between the migration and the new Worker joins the `workspaces` table on its next write, since every write ensures its workspace.
2. **Clients, in one release.** Before the extension ships, give every workspace an extension site uses a destination (through the new settings page, or `PUT /workspaces/{id}/jira`): storage version 3 drops the site's project key, so an unbound workspace has no project to fall back to.
   The extension settings get the admin token, the Jira accounts section, the workspace choice with **New workspace…** and the workspaces table. The overlay moves to the new routes, `getDestination` and the dialog's states. Storage version 3 drops `jiraProjectKey` from site settings in the same release, and `bind-site-jira-project.ts` and the project parameters in the gateway's `JIRA_METHODS` are deleted with it. A changeset deprecates `initSync({ jiraProjectKey })`.
3. **Cut over.** Add the environment account through the UI and bind the existing workspaces. A one-off script sets the origin of existing tickets to that account. Then remove the fallback, the old routes, the client project key and the `JIRA_*` variables. This supersedes ADR-0018's single-account part; its Zod-validated env pattern stays for the new secrets.
   - Release order: set the origins (one `UPDATE groups … WHERE jira_ticket_id IS NOT NULL AND jira_account_id IS NULL`, after checking that the stored account is the environment account's Jira user), then deploy the Worker, then delete the `JIRA_EMAIL` and `JIRA_API_TOKEN` secrets. A ticket left without an origin answers `jira-account-not-found`.
   - The destination's `signsInAs` becomes required, since every destination is a stored account.

### Consequences

- Good: each app sends tickets to its own Jira site and account, set up in the UI, without a deploy.
- Good: the account secret stays on the server, encrypted. Pages and host apps choose only a workspace.
- Good: rebinding a workspace is safe; old tickets stay readable through their own account.
- Good: the credential model has room for "Sign in with Atlassian".
- Bad: one more token to enter and keep (`SYNC_ADMIN_TOKEN`), and two more secrets to keep and, if ever exposed, rotate (`JIRA_CREDENTIAL_KEYS`).
- Bad: tickets carry the name of the token's owner unless a bot account is used.
- Bad: Jira Server and Data Center are out of scope.

### More information

- For option 3 later: Arctic's `Atlassian` provider (MIT, fetch-based, checked at 3.7.0) covers the OAuth code exchange and refresh, so no OAuth code would be hand-written. Calls then go to `api.atlassian.com/ex/jira/{cloudId}`, and the refresh token rotates, so each new one must be stored.

### Sources

- Atlassian, basic auth with an API token: https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/
- Atlassian, OAuth 2.0 (3LO) apps (multi-site grants, `accessible-resources`, rotating refresh tokens): https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
- Jira REST, current user (`/rest/api/3/myself`): https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-myself/
- Cloudflare Workers, Web Crypto (AES-GCM): https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
- Cloudflare Workers, secrets (bound at deploy; `wrangler secret put` deploys a version): https://developers.cloudflare.com/workers/configuration/secrets/
- Hono, Bearer Auth middleware: https://hono.dev/docs/middleware/builtin/bearer-auth
- MDN, `SubtleCrypto.encrypt()` with AES-GCM: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt
- OWASP, Server-Side Request Forgery prevention (allow-list the destination): https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
- Arctic, OAuth 2.0 clients (Atlassian provider): https://github.com/pilcrowonpaper/arctic
