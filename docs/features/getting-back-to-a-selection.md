# Getting back to a selection

A selection is an element that someone picked on a page and commented on. Later, that element is often not on the page that you look at. It can be on another page, on another site, or behind a tab or a dialog. This document describes the features that tell you where the selection is and take you back to it.

| Feature | What it does | Decision |
|---|---|---|
| [Overlay on any site](#overlay-on-any-site) | Runs the overlay with sync on a site that you enable in the browser extension | ADR-0023 |
| [Where a selection is](#where-a-selection-is) | Gives the reason that a selection is not on the page, and opens its page | ADR-0024 |
| [Record steps and session](#record-steps-and-session) | Saves the clicks and field changes that led to each new comment, and a replay | ADR-0025, ADR-0021 |
| [Steps on the card](#steps-on-the-card) | Shows the steps, downloads them for Chrome DevTools, and puts them in the Jira ticket | ADR-0025 |
| [Step guide](#step-guide) | Points at each step on the live page until you are back at the selection | ADR-0026 |

## Overlay on any site

The browser extension runs the overlay on each site that you enable. You do not change the code of that site. The service worker of the extension keeps the API token, and all calls to the sync server go through it. The page never gets the token.

To install and configure the extension, read [`packages/web-extension/README.md`](../../packages/web-extension/README.md).

## Where a selection is

When the element of a selection is not on the page, the overlay dims its row and gives the reason:

| Reason | Shown as | Action |
|---|---|---|
| Another page of this site | Made on /settings/billing | **Open page** |
| Another site | Made on localhost:3000, another site | None |
| This page, but the element is not there | No longer on this page | **Guide me**, if the selection has steps |
| No saved page address | Not on this page | None |

The reason shows in three places:

- the row in the comments panel;
- the card in the group detail view;
- the card on the Selections tab of the dashboard.

**Open page** goes to the saved address only on the same site. Only `http:` and `https:` addresses count as pages. For this reason, a saved `javascript:` or `data:` address can never run.

This feature uses the page address that every comment already has. It works for old comments too.

## Record steps and session

Each feature is off by default.

**Record steps** saves the clicks and field changes that led to each new comment. The format is the Chrome DevTools Recorder user flow. A flow starts with the page where recording began and keeps the last 50 steps. Each step has up to three selectors: the accessible name and role, a CSS selector, and the visible text.

**Record session** keeps the last minutes of the page as an rrweb replay. Each new comment links to that replay. When both features are on, each step is also a marker in the replay.

### Privacy

- Typed values are never saved. A field change is saved as "Change “Coupon” (value not saved)".
- The accessible name and the text of an element are not saved when they can contain typed input. This applies to an editable element, an element in an editor, and an element that holds a field. For example, the name of a table cell includes the value of the input in it.
- The clicks of React Grab itself are not steps. This includes the click that selects an element.
- Session replays mask all inputs.

### Turn the features on

In the browser extension:

1. Open the options of the extension.
2. Under **Enable a site**, select **Record steps**, or **Record session**, or both.
3. Click **Enable site**. Open tabs of that site reload.

In a host app that calls `initSync`, add the options:

```ts
initSync({
  // ...server, workspace and token
  options: {
    steps: { enabled: true },
    recording: { enabled: true },
  },
});
```

The sync server stores the steps on the comment. The migration `0007` adds the `steps` column.

## Steps on the card

A card with steps shows a collapsed **Steps (N)** list. Each step is one sentence, for example:

1. Open /settings
2. Click “Billing” (tab) → /settings/billing
3. Change “Coupon” (textbox, value not saved)

**Download Chrome Recorder flow** saves the steps as a JSON file. To replay the steps in Chrome:

1. Open Chrome DevTools.
2. Open the **Recorder** panel.
3. Click **Import recording**, then select the file.
4. Click **Replay**. Type the values that the flow did not save.

The default Jira description lists the same sentences under **Steps to reproduce**. Text from the page is escaped in the description. It cannot become a link or formatting in the ticket.

## Step guide

The guide takes you back to a selection on the live page. It never clicks or types for you.

**Guide me** shows when all of these are true:

- the selection is on another page of this site, or it is no longer on this page;
- the selection has steps;
- its first step is a page on this site.

To use the guide:

1. Click **Guide me** next to the reason.
2. If the first step is on another page, the guide opens that page.
3. Read the bar at the top of the page, for example "Step 1 of 2: Click “Billing” (tab)".
4. Click the highlighted element. The guide moves to the next step.
5. If a step does not apply anymore, click **Skip**. To end the guide, click **Stop**.

The guide stops when the selection is on the page again, and then it highlights the selection. The guide continues after a page load in the same tab.

### How the guide finds an element

The guide tries the saved selectors in the order of the Recorder: accessible name and role, CSS, text. A selector counts only when it matches exactly one visible element. If no selector matches, the bar says that the guide waits for the element. The guide looks again every 100 ms. As a result, it finds an element that a class, the `hidden` attribute or the `open` attribute shows.

## Limits

- A flow on a multi-page site starts at the last full page load.
- The steps do not include hover, scroll, keys, double clicks, iframes, or elements in a shadow root.
- A hash-routed app shows "No longer on this page" for a selection on another route, not "Made on …".
- A writer that does not know `steps` clears them when it saves the comment. Older overlay builds are such writers.
- The guide highlight uses the standard selection box of the overlay. On some backgrounds this box is hard to see. The guide scrolls the element into view to compensate.
- A selection from another site gets no **Open page** and no guide.

## Where the code is

| Part | Location |
|---|---|
| Reason and **Open page** | `packages/react-grab/src/features/selection-location/` |
| Step capture, step text, flow export, guide | `packages/react-grab/src/features/reproduce-steps/` |
| Step list, guide bar | `packages/react-grab/src/components/reproduce-steps/` |
| Reason on rows and cards | `packages/react-grab/src/components/selection-location/location-note.tsx` |
| Steps in the Jira description | `packages/react-grab/src/features/jira-ticket/business/default-description.ts` |
| Step schema and limits on the server | `packages/sync-server/src/schemas/reproduce-step.ts` |
| Site settings of the extension | `packages/web-extension/src/settings/` |

`architecture.yml` lists every file of each feature under `features.selection-location`, `features.reproduce-steps` and `features.overlay-on-any-site`.

## Decisions

- [ADR-0023](../../decree/adr/0023-overlay-on-any-site-through-the-browser-extension.md): overlay on any site through the browser extension
- [ADR-0024](../../decree/adr/0024-show-where-a-selection-was-made.md): show where a selection was made
- [ADR-0025](../../decree/adr/0025-capture-reproduce-steps-as-a-chrome-recorder-flow.md): capture the steps as a Chrome Recorder flow
- [ADR-0026](../../decree/adr/0026-guide-the-user-back-to-a-selection-step-by-step.md): guide the user back to a selection
