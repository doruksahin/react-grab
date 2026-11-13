---
date: '2026-11-13'
references:
- ADR-0019
- ADR-0020
status: accepted
---

# ADR-0021 Record how the user got to a selection with rrweb, and share it by a capability link

## Context and Problem Statement

A comment says *what* is wrong with an element. It does not say *how the user got there*: which pages they opened, what they clicked, what the screen looked like before. A product manager writing a comment cannot easily reconstruct that, and a developer reading the Jira ticket cannot reproduce it.

We want a visual record of the last few minutes before a selection, attached to the comment and reachable from the Jira ticket. Constraints:

- **Small.** A library at most — no third-party service, no SaaS account.
- **Works when injected.** react-grab is loaded into pages from outside (console, bookmarklet), after the page has started.
- **Canvas apps matter.** The first host is Cognograph, an infinite-canvas app.
- **Jira readers have no API token.** Every data route needs the bearer token (ADR-0020), and a token cannot go into a Jira link.

## Considered Options

1. **Text step log** — record clicks and navigation as a list of steps. Smallest, but not visual, which is the requirement.
2. **Browser video** — `getDisplayMedia` + `MediaRecorder`. No library and plays in Jira, but the browser asks for permission on every recording, and recording must be started by hand before the user knows they will need it.
3. **rrweb** — `@rrweb/record` records the DOM and its changes; `rrweb-player` replays them. Stable 2.2.2 (npm, 9 Nov 2026). The approach behind PostHog and Sentry session replay, used here as a library only.
4. **A session-replay service** (PostHog, Sentry, OpenReplay — the last two are already in AdCreative-Frontend-V2). Rejected: a third-party product, not a library.

For sharing with Jira readers:

- **A. Expiring signed link.** Tickets outlive any reasonable expiry, so links would break.
- **B. Viewable only inside react-grab.** Jira readers cannot watch it.
- **C. Capability URL** — a long random id that is itself the permission, like "anyone with the link" sharing.

## Decision Outcome

**Option 3 (rrweb) with sharing option C (capability URL).**

- Recording runs in the background from the moment react-grab starts, using rrweb's documented checkout mechanism (`checkoutEveryNms` with the `isCheckout` flag) to keep only the last five minutes. Because of rrweb's snapshot chain, the saved window is 5–10 minutes ([rrweb guide, Checkout](https://github.com/rrweb-io/rrweb/blob/main/guide.md)).
- When a comment is saved, the window is compressed with the browser's built-in `CompressionStream` and stored in R2 next to the screenshots.
- Each recording gets a random share id (`crypto.randomUUID()`, 122 random bits), which is also its R2 key, so no table is needed. `GET /r/{shareId}` serves a small player page; nothing else is needed to watch.
- Canvas is recorded as image snapshots at a low frame rate (`recordCanvas`, `sampling.canvas`), following rrweb's canvas recipe. Inputs are masked (`maskAllInputs`). react-grab's own overlay is excluded with `blockSelector`.
- Recording is opt-in per host (`options.recording.enabled`), like screenshots.

**This amends ADR-0020.** ADR-0020 says no route outside `/workspaces/*` and `/jira/*` may read data. `/r/{shareId}` is the one exception: the unguessable id is the credential, as the W3C TAG describes for capability URLs ([Good Practices for Capability URLs](https://w3ctag.github.io/capability-urls/)). Following that guidance, the page sends `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex`, and deleting the R2 object revokes the link.

### Consequences

- Good: a developer opens the Jira ticket and watches how the user got there, with no account and no token.
- Good: one new runtime dependency in the overlay (`@rrweb/record`); the player lives only on the Worker's page, not in the overlay bundle.
- Bad: anyone who obtains a link can watch that recording. Acceptable for an internal tool; inputs are masked, and a recording can be deleted.
- Bad: recording costs CPU and memory while the page is open, more with canvas recording. Opt-in, and the window is bounded.
- Neutral: recordings start when react-grab loads. When it is injected late, steps before injection are not in the recording.
