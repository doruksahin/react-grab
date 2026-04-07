---
date: '2026-04-08'
references:
- PRD-004
- ADR-0003
status: accepted
---

# ADR-0007 Atlassian internal GraphQL gateway for threaded Jira comments

## Context and Problem Statement

The selection-label panel needs to surface Jira comments threaded the same way Jira's own UI shows them: a root comment with replies indented underneath. The public Jira Cloud REST v3 Comment API (`GET /rest/api/3/issue/{key}?fields=comment`) returns comments as a **flat array** with no `parent`, `replyTo`, or threading field — every reply appears as an independent top-level entry. Comment properties (`/comment/{id}/properties`) were probed against `appier.atlassian.net` and returned `{ keys: [] }` for all comments. The official documentation confirms there is no public REST mechanism to retrieve thread parentage.

The Jira UI itself uses Atlassian's internal GraphQL gateway at `https://{tenant}.atlassian.net/gateway/api/graphql`, where the `JiraPlatformComment` type exposes both `threadParentId` and a `childComments` connection as first-class fields. This endpoint is not part of the documented public API but is reachable with the same basic-auth credentials we already use for REST (verified end-to-end on the tenant).

## Decision Drivers

- **Visual parity with Jira:** users expect replies to nest under their parent, not to appear as separate top-level entries. PRD-004 frames the sidebar/labels as a Jira mirror — reply structure is part of that mirror.
- **Honesty over heuristics:** an earlier proposal was to detect replies via leading `@mention` nodes in the ADF body and chronologically match to a recent prior author. This is brittle (any mid-comment mention false-positives, edited comments shift order) and reconstructs information that already exists structurally on the backend.
- **Auth simplicity:** reusing the existing `JIRA_EMAIL` + `JIRA_API_TOKEN` basic-auth pair means no new secrets, no OAuth flow, no session-cookie handling.
- **SSOT (PRD-004):** Jira is the source of truth for comment threading. Storing or recomputing the relationship locally violates SSOT.
- **Risk:** the gateway endpoint is undocumented. Atlassian can change the schema or auth model without notice. We accept this risk because the alternative is shipping something that visibly diverges from Jira's own UI.

## Considered Options

### Option A: Public REST + flat display

Use only the documented REST `fields=comment` endpoint. Render every comment as a top-level entry. Live with the divergence from Jira's UI.

**Pros:** zero unsupported surface area, no new dependencies, tiny diff.

**Cons:** replies look like new top-level comments. Users who post a reply in Jira will see it appear out of order in the label, indistinguishable from a root comment. Defeats the purpose of mirroring.

### Option B: Public REST + heuristic threading

Detect replies by inspecting the first ADF node of each comment body. If it's a `mention` node, treat the comment as a reply to the most recent prior comment authored by that mentioned user (within a time window). Strip the leading mention from the rendered body.

**Pros:** stays on documented REST. No undocumented endpoints.

**Cons:**
- False positives whenever a real comment legitimately starts by mentioning someone (common pattern).
- False negatives whenever Jira's own UI threads two comments without a leading mention (edited replies, mobile replies).
- Behavior diverges from Jira UI in ways that are hard to explain to users.
- Requires per-tenant tuning of the time window.
- Still hides information that exists structurally on the backend.

### Option C: Internal GraphQL gateway (chosen)

Call `https://{tenant}.atlassian.net/gateway/api/graphql` with a query that fetches `jira.issueByKey(cloudId, key).comments(rootCommentsOnly: true).edges[].node` plus each node's `childComments(first: 100).edges[].node`. Each `JiraPlatformComment` carries `commentId`, `threadParentId`, `created`, `author`, and `richText.adfValue.json`. Walk the tree server-side and emit a flat list with `parentId` populated.

`cloudId` is discovered once via the unauthenticated `/_edge/tenant_info` endpoint and cached in-memory per `JiraService` instance.

**Pros:**
- Real threading data, byte-for-byte identical to what the Jira UI sees.
- Single round-trip per ticket (one parallel GraphQL call alongside the existing REST status fetch).
- No heuristic to maintain, no edge cases, no false positives.
- Auth reuses the existing API token via HTTP Basic — no new credentials.

**Cons:**
- Endpoint is undocumented. Atlassian publishes no SLA and no schema stability guarantee.
- Schema changes would surface as `null` fields or query errors and require us to reissue an introspection + query update.

## Decision Outcome

Chosen option: **Option C — Internal GraphQL gateway**, because real thread fidelity is required by PRD-004 and the heuristic alternatives are dishonest in subtle ways that erode user trust. The maintenance risk of an undocumented endpoint is acceptable given that:

1. The query uses introspectable, well-named fields (`threadParentId`, `childComments`) that mirror the public schema's evolution.
2. A schema break degrades gracefully — `fetchThreadedComments` returns `[]` on any non-OK response, so the label silently shows zero comments rather than crashing.
3. The decision is reversible: switching back to flat REST is a single-method swap.

The implementation lives in `JiraService.fetchThreadedComments` (`packages/sync-server/src/services/jira.service.ts`) and is called in parallel with the existing REST `getIssue` call inside `getIssueStatus`.

## Consequences

**Positive:**
- Replies indent under their parent in the selection label, matching the Jira UI exactly.
- No heuristic surface area to maintain or tune per tenant.
- The chosen `JiraPlatformComment` shape gives us future fields (e.g. `permissionLevel`, `isDeleted`) without another integration round.

**Negative:**
- Bound to a non-public Atlassian endpoint. If/when Atlassian breaks the schema, we must update the query and likely re-introspect the gateway.
- Tenant-specific testing required: the gateway is reachable per `appier.atlassian.net`, but a different tenant could conceivably have it disabled or behind SSO.

**Mitigation:**
- The fallback path returns `[]` rather than throwing, so a broken gateway never breaks the rest of the status fetch.
- Schema dependence is isolated to one method (`fetchThreadedComments`) and one query string — no scattered references to GraphQL types.
