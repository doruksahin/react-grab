---
date: '2026-11-16'
references:
- ADR-0023
status: accepted
---

# ADR-0024 Show where a selection was made when its element is not on the page

## Context and Problem Statement

A saved selection points at an element. When that element is not on the page you are looking at, the comments panel dims the row and gives no reason, and "Copy" leaves it out without saying so. The sidebar card looks the same as a card whose element is on the page.

The element can be missing for three different reasons:

- The selection was made on another page of the same site, for example `/settings/billing`.
- The selection was made on another site. Since ADR-0023 the overlay runs on any site the user enables, so one workspace can hold selections from `localhost:3000` and from a deployed site.
- The selection was made on this page, but the element is no longer there (the UI changed, or a dialog is closed).

Every comment already stores `pageUrl` and `pageTitle` (`getPageContext`, written when the selection is saved). Nothing reads `pageUrl` except the default Jira description.

How do we tell the user where a missing selection was made, and get them back to it, without changing the server?

## Considered Options

1. **Compare the stored `pageUrl` with the current URL, show the reason, and offer "Open page" for same-site pages.** Pure client logic over data we already store.
2. **Hide selections whose element is not on the page.** Less noise, but the user loses sight of their own work, and the reason is still unknown.
3. **Navigate and replay the clicks automatically.** Rejected in the selection-return proposal: synthetic events are `isTrusted=false` and many apps ignore them, and replaying clicks on a live app can submit forms or create tickets. Captured steps and a guided, user-driven replay are later phases.
4. **Store a route id from the host app's router.** More exact for single-page apps, but each host app must integrate it, which breaks the plug-and-play goal of ADR-0023.

## Decision Outcome

Chosen option: **1**.

### Domain rule

`features/selection-location/business/locate-selection.ts` holds one pure function, `locateSelection({ pageUrl, currentUrl, isOnPage })`. It returns one of:

| Kind | When | Shown as |
|---|---|---|
| `on-page` | The element is on the page | nothing (row not dimmed) |
| `other-page` | Same origin, different path | "Made on /settings/billing" and "Open page" |
| `other-site` | Different origin | "Made on localhost:3000, another site" |
| `gone` | Same origin and path, element missing | "No longer on this page" |
| `unknown` | No stored `pageUrl`, it does not parse, or either URL is not http(s) | "Not on this page" |

URLs are parsed with the WHATWG `URL` API, and only `http:` and `https:` URLs count as pages. Other schemes are `unknown`: `javascript:`, `data:` and `file:` have an opaque origin, and a `blob:` URL takes the origin of its creator but is not a page. Two URLs are the same site when their `origin` is equal, and the same page when their `origin` and `pathname` are equal. Query and fragment are ignored, because they usually hold state (filters, tracking, scroll anchors), not a different page. A hash-routed app (`/#/settings`) therefore reads as `gone` instead of `other-page`; we accept this and revisit it if a hash-routed host appears.

The reason text comes from one function, `describeLocation`, so the panel and the sidebar cannot drift.

### Wiring

- `createCurrentPageUrl` gives the current URL as a signal. It listens to the Navigation API's `currententrychange` event, which fires for every same-document navigation, `pushState` included. The Navigation API is in all major engines (Chrome 102, Safari 26.2, Firefox 147); its types come from `@types/dom-navigation`, because TypeScript's DOM library does not include them yet. Without the API it falls back to the existing `domMutationVersion` signal, which misses a navigation that changes no nodes. The memo returns a string, so an unchanged URL notifies nobody.
- Core computes a `selectionLocations` memo from that URL, the existing disconnected-items memo and the items. It is rebuilt only when one of them changes, not on every DOM mutation.
- The UI reads it through a Solid context, `SelectionLocationProvider`, mounted next to `SyncProvider`. The sidebar cards are three levels away from core, and context is Solid's standard way to give a value to a subtree without threading props.
- `components/selection-location/` has two views over one hook (`useLocationView`): `LocationChip`, a comments panel row's status (the path, the host, or the reason, from `describeLocationShort`), and `LocationNotice`, the sidebar card's notice (a heading and a detail from `describeLocationNotice`, with "Open page" for `other-page`). The row only says where; the way back is in the card. Before the card redesign both used one `LocationNote` with the button in the row.

### "Open page"

"Open page" calls `window.location.assign(pageUrl)` only for `other-page`, so the target always has the current origin. It never opens another site: the stored URL may be a local dev server or a site the user did not enable, and a stored value from the server must not decide where the page goes across origins.

### Scope

- No server, schema or Orval change. Old comments work at once, because `pageUrl` has been stored since the first version.
- "Copy" keeps its behaviour (it copies only selections on the page).

### Consequences

- Good: a dimmed row always says why, and a same-site selection is one click away.
- Good: one pure rule, unit-tested, used by every view.
- Bad: hash-routed apps get `gone` instead of `other-page`.
- Bad: `/settings` and `/settings/` are different paths, so they read as `other-page`. The path is shown percent-encoded, as the URL holds it.
- Neutral: "Open page" is a full navigation. Single-page apps reload on it; this is acceptable for a dev tool and avoids depending on the host's router.

### Sources

- WHATWG URL Standard, origin and the `URL` API: https://url.spec.whatwg.org/#origin
- MDN `Location.assign()`: https://developer.mozilla.org/en-US/docs/Web/API/Location/assign
- Solid context: https://docs.solidjs.com/concepts/context
- Navigation API, `currententrychange`: https://developer.mozilla.org/en-US/docs/Web/API/Navigation/currententrychange_event
- `@types/dom-navigation`: https://www.npmjs.com/package/@types/dom-navigation
- MDN `Event.isTrusted` (why automatic replay is rejected): https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted
