---
date: '2026-11-18'
references:
- ADR-0024
- ADR-0025
- ADR-0026
status: accepted
---

# ADR-0032 Start a selection's steps where its page was last entered

## Context and Problem Statement

ADR-0025 keeps the last 50 steps of the document in a ring buffer, and taking a flow does not clear it. A full page load is the only thing that starts a new buffer. In a single-page app such as AdCreative that almost never happens, so a comment carries every step since the browser tab was opened. Each comment also carries the path to every comment made before it.

The step guide (ADR-0026) follows the flow from its first step. It opens the page where capture started and walks through every step, so it takes the user to the places of earlier selections before it reaches this one. When the guide starts on another page, it calls `location.assign`, which reloads the page and clears the buffer. The guided clicks are then recorded, so the next comment carries the guided tour.

Which steps belong to a selection?

## Considered Options

1. **Steps since the selection's page was last entered.** When a comment is created, keep only the trailing steps whose page (origin and path, the existing `pageKey`) is the selection's page. The `navigate` step opens that page. A page URL is a state that can be opened directly, so the steps on earlier pages are not needed to get back. The Chrome DevTools Recorder works the same way: a recording starts with a `navigate` to the page that was open when recording started, not with the pages before it.
2. **Steps since the previous comment.** Clear the buffer each time a flow is taken. This breaks flows: when two comments are made in one dialog, the step that opens the dialog belongs only to the first, so the second flow cannot be followed on its own.
3. **Steps in the last N minutes.** This would match the session recording window (SPEC-020). Any N is arbitrary: it can cut a step that is needed, or keep steps on other pages.
4. **An explicit "Start recording" control,** as the Recorder and Jam.dev have. This gives exact control, but it adds an action before every report, and a user who forgets to start it gets no steps.

## Decision Outcome

Chosen option: **1**, by the user on 2026-11-18, after an interactive comparison of options 1 to 3.

### Rule

- **Code location:** `features/reproduce-steps/business/steps-on-current-page.ts`, one pure function. `toReproduceSteps` applies it first. `pageKey` stays the single definition of a page (ADR-0024), so query and fragment changes do not end a page.
- **Cut point:** the last captured step whose page is not the current page. Everything up to and including that step is left out. Capture and the buffer do not change: the buffer still keeps 50 steps, and the rrweb markers (ADR-0025) still mark every step.
- **No steps on this page:** the flow is undefined, as when nothing was captured. The comment keeps its `pageUrl`, and ADR-0024's "Open page" still opens it.
- **Navigation assertions:** after the cut, every kept step and the current page share one `pageKey`. So a new flow never has a click that changed the page, and the code that added `assertedEvents` is removed. Stored flows keep theirs, and `describeStep` still shows "→ /path" for them.

### Stored flows

Comments saved before this rule keep their long flows. They were made while the feature was tried out, so no code reads them differently and no data migration runs.

### Consequences

- Good: a comment carries only the steps on its own page, so the guide opens that page and shows only those steps. In the case that was reported, the guide for a selection on the billing tab opens `/settings` and shows one step, not the 14 steps since the dashboard.
- Good: the guided tour of an earlier comment no longer leaks into later comments from other pages. It can still leak into a later comment on the same page. This is the reason the guide's clicks are not paused here; see below.
- Good: no new storage, listener or schema field. The change is to one pure function, and the server and Recorder export are unchanged.
- Bad: two comments on one page still share that page's steps. These steps are usually needed by both, for example the click that opens a dialog.
- Bad: a page whose URL cannot be opened directly loses the steps that led to it. An example is a wizard step that redirects without earlier state. The `navigate` step then opens a page that is not in the same state.
- Bad: a hash-routed app (`/#/settings`) is one page for `pageKey`, so nothing is cut there. This is the same limit as ADR-0024.
- Neutral: the guide's clicks are still recorded (ADR-0026, step 5). With this rule, a later comment gets them only when it is made on the same page, where they are real steps to it.

### Sources

- Chrome DevTools Recorder, start a recording and the JSON user flow: https://developer.chrome.com/docs/devtools/recorder/reference
- `Array.prototype.findLastIndex`: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findLastIndex
