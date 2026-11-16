---
date: '2026-11-16'
references:
- ADR-0025
- ADR-0024
status: accepted
---

# ADR-0026 Guide the user back to a selection, step by step

## Context and Problem Statement

ADR-0024 says where a selection was made and opens a same-site page. ADR-0025 stores the steps that led to it and shows them as a list and a DevTools flow. When the element is behind a tab, a dialog or a row that must be opened first, the user still has to read the list and find each control alone.

How can the overlay take the user back to the element on the live page, without acting on the page by itself?

## Considered Options

1. **A guide that highlights the next step's element and moves on when the user acts.** The user clicks and types; the overlay only shows where.
2. **Replay the steps automatically in the page.** Rejected in ADR-0024 and ADR-0025:
   - synthetic events have `isTrusted: false`, and many apps ignore them;
   - trusted input needs the `debugger` permission;
   - a replayed click can submit, delete or create a ticket.

   Replay belongs in DevTools, from the downloaded flow.
3. **No guide; the step list is enough.** It is cheaper, but it leaves the hardest part, finding each control on a changed page, to the user.

## Decision Outcome

Chosen option: **1**.

### When it is offered

"Guide me" is shown next to the reason of ADR-0024 (`LocationNote`) when all three are true:
- the selection is not on the page (`other-page` or `gone`);
- it has steps;
- its first step (the `navigate`) is an http(s) page with the current origin. Other schemes never count, so a stored `javascript:` or `data:` URL is never opened (the same `parseWebUrl` as ADR-0024).

A selection from another site gets no guide, as it gets no "Open page".

### How it runs

1. **Start.** If the current page is not the first step's page (origin and path), the guide opens it with `location.assign`, as "Open page" does, and continues there. Otherwise it starts at the second step.
2. **Each step.** The guide finds the step's element, scrolls it into view (`scrollIntoView({ block: "nearest" })`) and draws the overlay's existing highlight box on it; the box follows scroll. A bar shows the step's sentence from `describeStep` (ADR-0025), with "Skip" and "Stop".
   - For a `click` step, the guide waits for a click on that element, inside it, or on the same control (the button around a recorded label).
   - For a `change` step, it waits for a `change` event on it. The value is the user's to type; none was stored.
3. **Element not there yet.** While a guide runs it looks again every 100 ms, as Testing Library's `waitFor` polls, so an element shown by any change (a class, `hidden`, `open`, text) is found. An element found earlier is kept while it stays connected and visible, so the full search runs only while one is missing. The bar says it is waiting. The user can skip the step or stop.
4. **End.** The guide ends after the last step, or as soon as the selection's own element is back on the page. It highlights the selection and says so; if the selection is not there, it says that and keeps looking, because the last click's effect (a dialog opening) can land after the click.
5. **Selection mode and capture.** Clicks are taken from the same page-event source as step capture (ADR-0025): trusted page clicks only, never React Grab's UI, never a click that selects an element. The guided clicks are real user actions, so step capture records them too.
6. **Removed selection.** Once comments have loaded (sync `synced`, `local` or `error`), a stored guide whose selection no longer exists says so and is forgotten.

### Finding a step's element

A step's selectors are tried in the order the Recorder writes them. A selector counts only if it matches exactly one visible element. Visible means not excluded from the accessibility tree (`isInaccessible`, the check Testing Library uses). It does not cover zero size, off-screen, `opacity: 0` or `inert`; such an element can still be highlighted.

- **CSS:** `querySelectorAll`.
- **ARIA** (`aria/<name>[role="<role>"]`): elements whose role and accessible name equal the stored ones. They are computed with `dom-accessibility-api`, the library we already use and the one Testing Library's `queryAllByRole` is built on.
  - `queryAllByRole` itself was considered. It would add about 184 KB minified to the overlay, mostly test-error formatting (`pretty-format`, `lz-string`), for the same role and name comparison.
  - So the comparison is about fifteen lines on top of `dom-accessibility-api`. This was the user's choice on 2026-11-16.
- **Text** (`text/<text>`): the innermost element whose whitespace-collapsed text equals the stored text. This mirrors how capture produced it.

This is a pure function (`findStepTarget`) with unit tests.

### Surviving a page load

A step can cause a full page load. The guide keeps `{ selectionId, stepIndex }` in `sessionStorage`: the browser's per-tab store, which a load keeps and a closed tab drops. When the overlay starts, it resumes a stored guide once the selection's comment has loaded. Stop or the end clears it.

### Code layout

- **Pure rules:** `features/reproduce-steps/business/`:
  - `find-step-target.ts`;
  - `guide-progress.ts`: the first step and the next step.
- **Storage:** `features/reproduce-steps/store/guide-session.ts`, validated with Zod on read.
- **Hook:** `features/reproduce-steps/hooks/create-step-guide.ts` holds the signals, the listeners and the highlight bridge.
- **Page events:** `hooks/create-page-events.ts`, shared with step capture.
- **Context:** the hook's API reaches the UI through a Solid context next to `SelectionLocationProvider`, as in ADR-0024.
- **Highlight:** the hook exposes the element it points at; core adds it to the derived grabbed-box list, so it follows the theme switch like every other box. The hook's only effects are the interval, the scroll and the session store.
- **UI:** `components/reproduce-steps/guide-bar.tsx`; the "Guide me" button sits in `components/selection-location/location-note.tsx`, next to the reason it acts on.

### Consequences

- Good: the user gets back to a hidden element on a changed page, step by step, with nothing done in their name.
- Good: the pure parts (finding a target, progress) are unit-tested. The flow is tested end to end with trusted Playwright clicks.
- Bad: a step whose element changed beyond all three selectors cannot be found. The user skips it or stops.
- Bad: the highlight is the overlay's standard selection box (1px border, light fill), easy to miss on some backgrounds. The scroll into view and the bar's sentence make up for it.
- Bad: the ARIA comparison is our own code, though small and built on the standard library. If `@testing-library/dom` ever becomes cheap to bundle, it should replace it.
- Neutral: a selection from another site, or without steps, gets no guide.

### Sources

- Chrome DevTools Recorder selectors: https://developer.chrome.com/docs/devtools/recorder/reference
- Puppeteer ARIA and text selectors: https://pptr.dev/guides/page-interactions#selectors
- Testing Library `ByRole`: https://testing-library.com/docs/queries/byrole
- `dom-accessibility-api`: https://github.com/eps1lon/dom-accessibility-api
- MDN `sessionStorage`: https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage
- WAI-ARIA tree exclusion, used for visibility (`isInaccessible` in `dom-accessibility-api`): https://www.w3.org/TR/wai-aria-1.2/#tree_exclusion
- MDN `Element.scrollIntoView()`: https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView
