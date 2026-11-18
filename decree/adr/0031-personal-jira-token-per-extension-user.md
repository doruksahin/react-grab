---
date: '2026-11-18'
references:
- ADR-0020
- ADR-0023
- ADR-0027
status: accepted
---

# ADR-0031 Each extension user signs in to Jira with their own API token

## Context and Problem Statement

We want each selection, ticket and comment to show the person who made it. Today every Jira call goes through the workspace's Jira account (ADR-0027): the email and API token someone with the admin token added once. Everyone in a workspace therefore writes as that one person. In Jira, the Reporter of every ticket and the author of every comment made from React Grab is the account's owner. The overlay has no idea who is at the keyboard, and `CommentItem.capturedBy` exists in the schema and in D1 but nothing fills it.

The sync server cannot tell users apart either. Every caller sends the same `SYNC_API_TOKEN` (ADR-0020), so a request that only names a person ("post this as Ayşe") could be forged by anyone who has that token.

How does React Grab learn who the user is, and act in Jira as that person?

## Considered Options

1. **Keep the shared account and let each person pick themselves in the extension's settings.** No new credential, and users without a Jira seat keep working. But the name is self-declared, Jira still shows the account's owner everywhere, and anyone can pick anyone.
2. **Each extension user pastes their own Jira API token into the extension's settings. The service worker keeps it and sends it with each request, and the server uses it for that request only, then forgets it.** Jira itself proves who the person is. Tickets and comments are theirs in Jira too.
3. **Each user's token stored on the server, chosen per request by a user id.** The server cannot tell callers apart (ADR-0020), so whoever has the sync token could act as anyone. This needs per-user server credentials first.
4. **"Sign in with Atlassian" (OAuth 2.0 3LO).** The proper form of option 2: scoped, revocable, no copied tokens, refresh handled by Atlassian. It needs an app registered at Atlassian, a callback route and refresh-token storage (ADR-0027, option 3).

## Decision Outcome

Chosen option: **2**, by the user on 2026-11-18 ("herkes kendi tokenini yapıştıracak şekilde yapalım"), happy path first. It keeps option 4 open: OAuth can later replace the pasted token as the source of the same per-request credential.

### User flow

1. In the extension's settings, a new **Your Jira account** section takes the user's Atlassian email and API token (id.atlassian.com → Security → API tokens). **Save** asks the server who the token signs in as on the Jira site of the user's first enabled workspace. When it is accepted, the section shows "Signed in as Ayşe Yılmaz".
2. From then on, the overlay on every enabled site acts as that person. Tickets they create have them as Reporter, and comments they post are theirs in Jira.
3. Each selection they make carries their Jira display name as `capturedBy`. The sidebar shows it on the row and the card ("Captured by"), next to the Jira **Assignee**, which is now labelled. The sidebar's **Filter** menu gains **Captured by**.
4. With no personal token, everything works as before, through the workspace's account, and new selections have no `capturedBy`.

### Rules

- **Where the token lives.** In `chrome.storage.local`, restricted to trusted contexts, read only by the service worker, like the sync token (ADR-0023). It never reaches a page. The overlay learns only the display name.
- **How it travels.** The service worker adds `X-Jira-Credential: base64(email:apiToken)` to each sync-server request, next to `Authorization: Bearer <SYNC_API_TOKEN>`. The server's CORS policy allows the header. Host apps (`initSync`) send nothing and keep using the workspace's account.
- **What the server does with it.** `JiraClientFactory` is still the one place that picks the credential (ADR-0027). When a request carries `X-Jira-Credential`, it builds the Jira client with that email and token instead of the stored account's. The site stays the stored account's site: the workspace's destination for new tickets and pickers, and the ticket's origin for reading and commenting. The server never stores the personal token and never logs it.
- **Amends ADR-0027.** "A ticket is always read and commented on through the account that created it" now means: on the site of that account, with the caller's personal credential when there is one. The ticket origin (`groups.jira_account_id`) keeps pointing at the workspace's account, which names the site.
- **Who the user is.** `GET /workspaces/{id}/jira/me` answers who the request's credential signs in as on the workspace's site (`/rest/api/3/myself`). Settings calls it on **Save** and stores the answer (`accountId`, `displayName`) beside the token. The overlay asks the service worker for the display name (`getJiraUser`) and passes it to `initSync({ user })`.
- **`capturedBy` holds the display name for now,** like `jiraAssignee` and `jiraReporter`, so that filtering and display need no user directory. Matching on names breaks when someone is renamed. The Jira `accountId` is the right key later (see below).

### Consequences

- Good: the person is proven by Jira, not declared. Jira shows the real Reporter and comment authors with no extra lines.
- Good: one decision point on the server, one header, and no schema change.
- Bad: every user needs an account with create and comment permission on that Jira site. A user without one keeps working only through the shared account, with no `capturedBy`.
- Bad: Atlassian API tokens act for the whole Atlassian account, not only Jira, and expire after at most a year. Each browser now holds one.
- Bad: a user who cannot see a project cannot read its tickets through their own token, where the shared account could.

### Left for later (not in the happy path)

- **An expired or revoked token.** Today a Jira 401 surfaces as the usual Jira error. Settings should show "token expired, paste a new one" and offer to fall back to the shared account.
- **Atlassian accounts on more than one Jira site.** One API token works on every site the person's Atlassian account can open, so one credential is enough today. Verification only checks the first workspace's site.
- **`capturedBy` as `accountId`,** with names and avatars resolved through `/workspaces/{id}/jira/users`, so renames and duplicate names are safe.
- **Scoped API tokens or OAuth (option 4),** instead of full-power classic tokens.
- **Host apps.** `initSync({ user })` can carry a name, but a host app has no personal Jira credential. It still writes as the workspace's account.
- **Reporter filter.** It becomes meaningful only for tickets created with personal tokens. Older tickets all show the shared account.
