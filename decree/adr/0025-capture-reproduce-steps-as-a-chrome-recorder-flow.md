---
date: '2026-11-16'
references:
- ADR-0024
- ADR-0021
- ADR-0023
status: accepted
---

# ADR-0025 Capture the steps to a selection as a Chrome Recorder flow

## Context and Problem Statement

ADR-0024 says where a selection was made, and opens a same-site page. It cannot say how to get from that page to the element: which tab was opened, which dialog, which row. The rrweb recording (ADR-0021) shows it as video, but its clicks point at rrweb node ids, which only mean something inside a rebuilt copy of the DOM. They cannot be listed, followed, or replayed.

We want each new comment to carry the steps that led to it, in a form that (later phases) can be listed in the sidebar, used to guide the user, and replayed by a developer in Chrome DevTools.

## Considered Options

1. **Capture clicks and field changes at the time they happen, and store them in the Chrome DevTools Recorder user-flow format.** This is what Sentry, PostHog and OpenReplay do for their click lists: capture separately at click time. It does not parse the recording afterwards. The Recorder format is the published standard: DevTools imports and replays it, and `@puppeteer/replay` publishes its schema and a runner.
2. **Derive the steps from the rrweb recording.** We would rebuild rrweb's DOM copy from the snapshot and every mutation, then map node ids to selectors. No vendor does this. It only works when recording is on, and it breaks when the page changes between the recording and the reading.
3. **Our own step format.** It would be simpler to start with, but nothing could import it. Every consumer (DevTools, Puppeteer, Lighthouse user flows) would need a converter we maintain.

## Decision Outcome

Chosen option: **1**.

### Step format

A comment gets an optional `steps` field: an array of Recorder steps. Only three types are captured:

| Step | Recorder fields kept | Captured from |
|---|---|---|
| `navigate` | `url` | The page URL when capture started (first step only) |
| `click` | `selectors`, `offsetX`, `offsetY`, `assertedEvents` | A trusted `click` |
| `change` | `selectors`, `value` (always `""`) | A trusted `change` on an input, textarea or select |

- **Selectors.** Each step has up to three alternatives, in the order the Recorder writes them:
  1. **ARIA:** `aria/<name>[role="<role>"]`, from the WAI-ARIA accessible name and role. It is computed with `dom-accessibility-api`, the library Testing Library uses.
  2. **CSS:** from the existing `createElementSelector`, which uses `@medv/finder` and prefers test ids.
  3. **Text:** `text/<text>` for short visible text.
- **Page changes inside the app.** A click after which the page (origin and path) is different gets `assertedEvents: [{ type: "navigation", url }]`. The Recorder reference describes `assertedEvents` as the events a step is expected to cause. A change only to the query or fragment (a search box writing `?q=`, an anchor) is not asserted. If the URL is too long for the server, the click keeps no assertion.
- **No values.** A `change` step stores `value: ""`. This matches the masked inputs of ADR-0021. In a DevTools replay the developer types the value.
- **No values through names or text either.** The accessible name of a button, row, cell or option includes the live value of a field inside it (WAI-ARIA AccName, step 2E), and an editor's text is what was typed. So the ARIA and text selectors are left out for any element that is editable, sits in an editor, or holds a field. A field's own ARIA selector is kept, because its name comes from its label.
- **Not captured:** hover, scroll, keys, double clicks, iframes, and clicks inside a component's shadow root (the event is retargeted to the host, which would make a wrong step). The goal is a readable path to the element, not a full replay.

### Capture

- **Code location:** a new feature, `features/reproduce-steps/`.
  - `business/` holds pure functions: build a step from a target, and turn the buffer into a flow.
  - `hooks/create-step-capture.ts` holds the listeners and a ring buffer.
- **Listeners.** Capture-phase `click` and `change` listeners on `document`.
  - Only events with `isTrusted` are used, so the page's own synthetic events are not steps.
  - Events from the overlay are ignored, using the existing `isEventFromOverlay` check. React Grab's own UI is never a step.
  - The click that selects an element is not a step. A selection ends on `pointerup`, which turns selection mode off before `click` fires, so a click is judged by the `pointerdown` that started it. Keyboard clicks (`detail` 0) have no press and are always kept; a cancelled press is forgotten.
- **Ring buffer.** It keeps the last 50 steps of this document, each with the URL at the time of the event. Taking a flow does not clear the buffer, so two comments on one page both get the full path.
- **Saving.** When a comment is created, the overlay saves the flow on it. The flow is a `navigate` to the first kept step's URL, followed by the kept steps.
- **Full page loads.** A full page load starts a new buffer, because the buffer lives in the page's memory. For a multi-page site the flow starts at the last full load. The `navigate` step still opens that page.
- **rrweb markers.** When session recording is also on, each step is written into the recording with rrweb's `record.addCustomEvent("react-grab-step", step)`. This is the way Sentry adds its breadcrumbs, and it puts markers in the replay at the same moments.

### Configuration

- **Options.** `Options.steps = { enabled: boolean }` turns capture on. The default is off, like `recording`.
- **Extension.** The browser extension (ADR-0023) adds two settings per site, both off by default:
  - "Record steps" sets `steps`;
  - "Record session" sets `recording`.
- **Stored settings.** Site settings stored before this change get both settings set to off. This uses `@wxt-dev/storage` item versioning (`version: 2` with a migration), the library's own way to change a stored shape.

### Storage and limits

- **Server.** It adds a `steps` JSON column to `comments`, through a Drizzle migration. It validates `steps` with Zod:
  - at most 51 steps (one `navigate` plus 50);
  - at most 3 selectors per step;
  - at most 512 characters per selector;
  - URLs at most 2048 characters.
- **Contract.** OpenAPI and the Orval clients are regenerated from that schema (the `api_contract` chain).
- **Old Worker.** An old Worker drops the unknown field (Zod strips unknown keys), so a new client works with an old Worker.
- **Deploy order.** Run the migration (`pnpm --filter @react-grab/sync-server db:migrate:prod`) before deploying the new Worker. A new Worker without the column fails every comment read and write.
- **Older writers.** Comment writes replace the whole comment (ADR-0019), so a writer that does not know `steps` clears them: an older overlay build, or an older extension whose gateway drops the field. This is the same rule as `recordingUrl`. It lasts only until every writer is updated.

### Display and export (phase 3, 2026-11-16)

- **One readable sentence per step**, from one pure function (`describeStep`), used by the sidebar and the Jira description alike:
  - `navigate` → "Open /settings"
  - `click` → "Click “Billing” (tab)", and "→ /settings/billing" when it asserts a navigation
  - `change` → "Change “Coupon” (textbox, value not saved)"
  - The label comes from the step's own selectors: the ARIA name first, then the text, then the CSS selector. Nothing else is stored or looked up. Paths leave out the query; a hash route (`#/…`) is kept.
- **Sidebar.** A selection card with steps shows a collapsed "Steps (N)" list and a "Download Chrome Recorder flow" button. The Recorder imports recordings only from a JSON file (Recorder reference, "Edit user flows"), so the button downloads one: `{ title, steps }`, the Recorder's user-flow shape, saved with FileSaver.js (`file-saver`), which handles the browser differences of Blob downloads. In DevTools: Recorder → Import recording → choose the file → Replay.
- **Jira.** The default description lists the steps under each selection as "Steps to reproduce". Step text comes from the page, so it is escaped with CommonMark backslash escapes (spec 2.4) before it reaches Markdown; it cannot become a link, emphasis or a heading in the ticket. The JSON flow is not put in the ticket: it is long, and the readable list is what a ticket reader needs.

### Consequences

- Good: each new comment carries a readable, replayable path in a standard format, even with video recording off.
- Good: no new route and no new storage. The flow travels with the comment.
- Good: conformance is tested against `@puppeteer/replay`'s own `parse()` (a dev dependency, used only in tests).
- Bad: accessible names and short texts can contain personal data shown on the page (a user's name on a button). This is the same exposure as the HTML snapshot already stored in `content`. Input values are never stored.
- Bad: a flow from a multi-page site starts at the last full page load.
- Bad: a flow stores up to 51 page URLs. A query string or fragment can hold a search term or a token, the same exposure as `pageUrl` today, now repeated.
- Bad: a step the server would refuse (no usable selector) is left out, so a flow can have a gap.
- Neutral: old comments have no steps. They keep ADR-0024's "Open page".

### Sources

- Chrome DevTools Recorder, JSON user flow: https://developer.chrome.com/docs/devtools/recorder/reference
- `@puppeteer/replay` schema and `parse`: https://github.com/puppeteer/replay
- Puppeteer ARIA and text selectors: https://pptr.dev/guides/page-interactions#selectors
- `dom-accessibility-api` (accessible name and role): https://github.com/eps1lon/dom-accessibility-api
- rrweb custom events: https://github.com/rrweb-io/rrweb/blob/master/docs/recipes/customize-event.md
- Sentry writes breadcrumbs into rrweb as custom events: https://github.com/getsentry/sentry-javascript/pull/7395
- WXT storage versioning and migrations: https://wxt.dev/storage#versioning-with-migrations
- CommonMark backslash escapes: https://spec.commonmark.org/0.31.2/#backslash-escapes
- FileSaver.js: https://github.com/eligrey/FileSaver.js
- MDN `Event.isTrusted`: https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted
