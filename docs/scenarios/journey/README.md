# React Grab journey: select → Jira → fix

This folder is the scenario map for the main React Grab loop. It answers one question per scenario: is it designed, is it built, and is it tested?

- `scenarios.md` holds every scenario in Given / When / Then form, grouped by journey step.
- This file holds the personas, the journey backbone, the legend and the prioritized gaps.

Method: a user story map (backbone of steps, scenarios under each step) with Gherkin-style acceptance scenarios. See Jeff Patton, *User Story Mapping*, and the Cucumber Gherkin reference.

Snapshot date: 2026-11-13. Code status is from `HEAD 40aeb71c` (react-grab 0.2.0 core behind the product UI). Design status is from the Penpot file "React Grab · Custom UI & States".

## Personas

| ID | Persona | Where they work | What success means for them |
|---|---|---|---|
| P1 | Reporter: developer, QA or designer | The running host app with the overlay | "I pointed at the problem and said what is wrong. I did not write a ticket by hand." |
| P2 | Triage owner: product manager or lead | The sidebar (and later the dashboard) | "I see all feedback in groups, and I can turn a group into one good ticket." |
| P3 | Assignee: the developer who gets the ticket | Jira, then the codebase | "The ticket tells me which component, which file, and where on the page. I can reply without leaving context." |

## Backbone

| Step | Name | Main persona | Penpot reference |
|---|---|---|---|
| 1 | Select an element | P1 | P07 "1 · Element seç", "2 · Mark target" |
| 2 | Comment on it | P1 | P07 "3 · Write / Save comment", P05 01 |
| 3 | Group it | P1, P2 | P07 "4 · Add to group / Pick group", P05 02–07 |
| 4 | Review in the sidebar | P2 | P03 (static only) |
| 5 | Create a Jira ticket | P2 | P07 "5 · Ready for Jira" → "8 · Ticket summary", P05 08–09 |
| 6 | Track the ticket | P1, P2 | P01 label states, P03 legend (static only) |
| 7 | Discuss on the ticket | P2, P3 | P04 comments (static only) |
| 8 | Act on the ticket | P3 | none |

Page codes: P01 Custom labels, P03 Sidebar & groups, P04 Jira & editor, P05 Clickable prototype, P06 Edge cases on Cognograph, P07 End to end.

## Legend

Each scenario has three columns.

| Column | Values |
|---|---|
| Design | `flow` (clickable in a Penpot flow) · `static` (state board, no flow) · `none` |
| Code | `done` · `partial` · `missing` |
| Test | `e2e` (Playwright) · `unit` · `none` |

A scenario is **covered** when design is `flow` or `static`, code is `done`, and test is `e2e`.

## Prioritized gaps

Priority is impact on the core promise ("select, comment, create, and the ticket has everything") divided by effort. The effort column is a first guess.

| # | Gap | Scenarios | Why it matters | Effort |
|---|---|---|---|---|
| 1 | **Done (RG-1, 2026-11-13).** The ticket had no page URL. Comments now store `pageUrl` and `pageTitle`, and the description links each selection to its page. | S5.6, S8.1 | P3 can find where the problem is. | S |
| 2 | **Done (RG-2, 2026-11-13).** Jira create had no validation, no retry and no success state, and none of the submit path was tested. All three are in, covered by five acceptance tests. | S5.3, S5.4, S5.5 | The demo's main moment now confirms itself and is tested. | M |
| 3 | The group menu does not flip near viewport edges, so it is clipped. P06 designs the fix and measures the clipping (189 px right, 113 px bottom). | S3.5 | Visible bug on real host apps such as Cognograph. | S |
| 4 | The sidebar "Retry" button when the sync server is unreachable has an empty handler. | S4.6 | A dead button in an error state erodes trust. | S |
| 5 | No undo after removing a comment. The P05 "Undo" button only restarts the flow. | S2.5 | Removal is easy to do by mistake and cannot be reverted. | M |
| 6 | Flag/blocked toggle does not write back to Jira (PRD-008 is still draft). | S6.4 | P2 must leave the app to flag work. | M |
| 7 | No deep link from the ticket that opens the app and reveals the selection. | S8.2 | Strong differentiator, but it needs gap 1 first. | L |

Test-only gaps (code is done, no e2e test): group create / rename / delete / move (S3.1–S3.4), comment persistence after reload (S2.3), remove one comment (S2.4), ticket lock (S3.6), sidebar search and bulk move (S4.3, S4.4), several selections in one ticket (S5.2).

Design-only gaps (code is done, no Penpot flow): screenshots in the flow (S5.7), group rename / delete (S3.3, S3.4), sidebar search, filter and bulk (S4.2–S4.4), offline (S4.6), Jira comment thread after linking (S7.*).

## How to keep this current

- When a scenario changes status, edit its row in `scenarios.md` and the gap table above in the same commit.
- When a new e2e test covers a scenario, tag it with the scenario's SPEC tag and put the test file in the Test column.
- New scenarios get the next free ID in their step (`S<step>.<n>`). Never reuse an ID.
