# Journey scenarios

Personas, legend and gap priorities are in `README.md`. Paths: `rg/` is `packages/react-grab/`, tests are under `rg/e2e/`.

## Step 1 · Select an element (P1)

| ID | Scenario | Design | Code | Test |
|---|---|---|---|---|
| S1.1 | Activate select mode | flow (P07 1) | done | e2e (`activation.spec`, `keyboard-shortcuts.spec`, `hold-activation.spec`) |
| S1.2 | Capture one element | flow (P07 2) | done | e2e (`selection.spec`, `toolbar-selection-hover.spec`) |
| S1.3 | Capture several elements by dragging | none | done | e2e (`drag-selection.spec`) |
| S1.4 | Copy element context to the clipboard | static (P01 copying / copied / error) | done | e2e for success (`copy-feedback.spec`), none for the error label |

**S1.1 Activate select mode**
- Given the host app runs with the overlay and the toolbar is visible
- When P1 clicks the select icon or uses the activation shortcut
- Then hovered elements are highlighted and the toolbar shows the active state

**S1.2 Capture one element**
- Given select mode is active
- When P1 clicks an element or presses Enter on the highlighted one
- Then the element is marked and the comment label opens next to it

**S1.3 Capture several elements by dragging**
- Given select mode is active
- When P1 drags a box over several elements
- Then all elements inside the box are captured as one selection

**S1.4 Copy element context**
- Given an element is captured
- When P1 copies it
- Then the label shows "Copied", or an error message if the copy failed

## Step 2 · Comment on it (P1)

| ID | Scenario | Design | Code | Test |
|---|---|---|---|---|
| S2.1 | Write and save a comment | flow (P07 3, P05 01) | done | e2e (`input-mode.spec`, `prompt-mode.spec`) |
| S2.2 | Edit a saved comment | none | done | e2e (`history-items.spec`) |
| S2.3 | Comment survives a reload (synced) | none | done | none |
| S2.4 | Remove one comment | flow (P05 11–12) | done | none (only "clear all" is tested) |
| S2.5 | Undo a removal | flow, stubbed (P05 12 "Undo" restarts the flow) | missing | none |
| S2.6 | A linked comment cannot be removed | none | done (remove hidden when group has a ticket) | none |

**S2.1 Write and save a comment**
- Given an element is captured and the label is open
- When P1 types a comment and presses Enter
- Then the comment is saved and the label shows the saved state

**S2.3 Comment survives a reload**
- Given the sync server is reachable and P1 saved a comment
- When P1 reloads the page
- Then the comment and its highlight come back

**S2.4 Remove one comment**
- Given a saved comment that is not linked to a ticket
- When P1 chooses Remove and confirms
- Then the comment and its highlight disappear, and other comments stay

**S2.5 Undo a removal**
- Given P1 just removed a comment
- When P1 chooses Undo within the toast's lifetime
- Then the comment comes back with its text, group and screenshots

## Step 3 · Group it (P1, P2)

| ID | Scenario | Design | Code | Test |
|---|---|---|---|---|
| S3.1 | Create a group from the group picker | flow (P05 05–07, P07 4) | done | unit only |
| S3.2 | Move a comment to an existing group | flow (P05 02, P07 4 Pick group) | done | unit only |
| S3.3 | Rename a group | none | done (toolbar comments menu only, not sidebar) | none |
| S3.4 | Delete a group; its comments become ungrouped | none | done (toolbar comments menu only) | none |
| S3.5 | Group menu stays on screen near viewport edges | flow (P06 01–05, controls 06–07) | partial (label flips, group menu does not) | none |
| S3.6 | A linked comment's group is locked | flow, note only (P05 09 "Bağlı yorumun grubu sabit") | done (`ticket-lock.ts`) | unit only |
| S3.7 | Remove a comment from a group before sending to Jira | flow (P07 "Remove before Jira") | done (move to ungrouped) | none |

**S3.1 Create a group**
- Given a saved comment that is ungrouped
- When P1 opens the group picker, chooses "New group…" and enters "Mobile experience"
- Then the group exists and the comment is in it, and the label shows "Moved to Mobile experience"

**S3.5 Group menu near edges**
- Given a captured element near the right or bottom edge of the viewport
- When P1 opens the group menu
- Then the menu flips or shifts so it is fully visible (P06 controls show 189 px clipped on the right and 113 px at the bottom without the fix)

**S3.6 Locked group**
- Given a comment whose group is linked to a Jira ticket
- When P1 opens the group picker
- Then other groups are not selectable and a lock icon explains why

**S3.7 Remove from group before Jira**
- Given a group with two comments, not yet linked
- When P2 takes one comment out of the group
- Then the comment becomes ungrouped and is not deleted ("removing from a group ≠ deleting")

## Step 4 · Review in the sidebar (P2)

| ID | Scenario | Design | Code | Test |
|---|---|---|---|---|
| S4.1 | Open the sidebar and see groups | static (P03 default, expanded, P07 sidebar-open boards) | done | e2e (`sidebar.spec`) |
| S4.2 | Filter by status, due date or flagged | static (P03 filter) | done | e2e for due date (`mocked/due-date-filter.spec`) |
| S4.3 | Search selections | none | done | none |
| S4.4 | Move several selections at once | static (P03 bulk) | done (bulk move only) | none |
| S4.5 | Open a group's detail view | static (P03 detail) | done | e2e (`sidebar.spec`) |
| S4.6 | Sync server unreachable | static (P02 offline, P03 offline) | partial (Retry button does nothing) | none (only "local" state tested) |
| S4.7 | Sidebar open or closed does not hide the label | flow (P06 canvas safe / sidebar closed) | partial (sidebar overlays, label does not shift) | none |

**S4.2 Filter**
- Given groups with tickets in different statuses and due dates
- When P2 picks "Overdue" in the due-date filter
- Then only groups with an overdue ticket stay, and a chip shows the active filter

**S4.6 Sync server unreachable**
- Given the sync server does not answer
- When P2 opens the sidebar
- Then it says "Could not connect to sync server.", and Retry tries again and shows the result

**S4.7 Sidebar and label**
- Given a label near the right edge
- When P2 opens the sidebar
- Then the label stays fully visible (P06 shows a 320 px shift)

## Step 5 · Create a Jira ticket (P2)

| ID | Scenario | Design | Code | Test |
|---|---|---|---|---|
| S5.1 | Create a ticket from a group | flow (P07 5–8, P05 08–09) | done | none (`sidebar.spec` only opens the dialog) |
| S5.2 | Several selections in one ticket | flow (P07 multi branch, "UI-128 · 2 selections linked") | done | none |
| S5.3 | Required fields block submit | board (P08 G2.1) | done (RG-2: summary and work type gate submit, missing fields marked) | e2e (`mocked/jira-create-dialog.spec`) |
| S5.4 | Submit fails, form is kept, retry | flow (P07 6), board (P08 G2.3) | done (RG-2: banner above the fields, Retry button) | e2e (`mocked/jira-create-dialog.spec`) |
| S5.5 | Submit succeeds and shows the ticket key | flow (P07 7), board (P08 G2.4) | done (RG-2: dialog confirms the ticket and stays open) | e2e (`mocked/jira-create-dialog.spec`) |
| S5.6 | Ticket description has everything P3 needs | none | done (RG-1: page title and URL per selection) | e2e (`mocked/jira-ticket-page-link.spec`), unit (`jira-defaults.test`) |
| S5.7 | Screenshots are attached to the ticket | none (P07 form always shows "No screenshots") | done | none (lightbox only: `mocked/screenshot-lightbox.spec`) |
| S5.8 | Create a ticket for one ungrouped comment | flow (P05 08) | done (synthetic group) | e2e (`mocked/jira-ticket-page-link.spec`) |

**S5.1 Create a ticket from a group**
- Given a group "Mobile experience" with one comment and no ticket
- When P2 opens "Create Jira ticket", keeps the prefilled summary and description, and submits
- Then a ticket is created and the group shows its key (for example UI-128)

**S5.2 Several selections in one ticket**
- Given a group with two comments on different elements
- When P2 creates a ticket for the group
- Then the description lists both selections and both sets of screenshots are attached

**S5.3 Required fields**
- Given the Jira form is open
- When P2 clears the summary (whitespace does not count) or no work type is selected
- Then submit is disabled and the missing field shows "Required"

**S5.4 Submit fails**
- Given the Jira form is filled
- When the request fails
- Then a banner above the fields says "Could not create the ticket. Your form is kept.", every field keeps its value, and the submit button becomes Retry

**S5.5 Submit succeeds**
- Given the Jira form is filled
- When the request succeeds
- Then the dialog stays open and shows "✓ <key> created", the line "This group is now locked to <key>.", an "Open in Jira" link and a Done button, and the group is locked (S3.6)

**S5.6 Ticket description content**
- Given a comment on the `CardDescription` component on `/projects/42`
- When P2 creates a ticket
- Then the description has the comment text, component name, file path and line, a selector, and the page URL and title

**S5.7 Screenshots attached**
- Given the comment has element and full-page screenshots
- When P2 creates a ticket
- Then both are attached in Jira and previewed in the form before submit

## Step 6 · Track the ticket (P1, P2)

| ID | Scenario | Design | Code | Test |
|---|---|---|---|---|
| S6.1 | Status colors on label and sidebar | static (P01 saved-jira, P03 legend) | done | e2e (`selection-status-colors.spec`, `mocked/jira-selection-label-visual.spec`) |
| S6.2 | Status refreshes without reload | none | done (30 s polling) | e2e (`mocked/sync-refresh.spec`) |
| S6.3 | Assignee and reporter avatars | static | done | e2e (`sidebar.spec`) |
| S6.4 | Flag or unflag a ticket as blocked | static (P01 saved-jira-flagged) | partial (shows flag, cannot toggle) | none |
| S6.5 | Due date on cards | static | done | e2e (`mocked/due-date-filter.spec`) |

**S6.2 Status refresh**
- Given a linked group whose ticket is "To Do"
- When someone moves the ticket to "In Progress" in Jira
- Then within about 30 seconds the label and sidebar show the new status color

**S6.4 Flag toggle**
- Given a linked group
- When P2 flags it as blocked from the sidebar
- Then Jira gets the flag and the label shows the blocked indicator

## Step 7 · Discuss on the ticket (P2, P3)

| ID | Scenario | Design | Code | Test |
|---|---|---|---|---|
| S7.1 | Read the Jira comment thread in the label or sidebar | static (P04 comments) | done | e2e (`mocked/jira-comment-sidebar-visual.spec`) |
| S7.2 | Write a comment back to Jira | static (P04 editor) | done | e2e (`mocked/verify-spec-013.spec`, `mocked/jira-comment-write.spec`) |
| S7.3 | Reply to a comment | static (P04 reply) | done | e2e (`mocked/verify-spec-013.spec`) |
| S7.4 | Mention a person and attach an image | static (P04) | done | e2e (`mocked/verify-spec-013.spec`) |
| S7.5 | Posting a comment fails | none | done | e2e (`mocked/verify-spec-013.spec` failed POST) |

**S7.2 Write a comment back**
- Given a linked group with a thread
- When P2 writes "Fixed on staging?" and saves
- Then the comment appears in Jira and at the end of the thread

## Step 8 · Act on the ticket (P3)

| ID | Scenario | Design | Code | Test |
|---|---|---|---|---|
| S8.1 | Find the page from the ticket | none | done (RG-1: comments store `pageUrl` and `pageTitle`) | e2e (`mocked/jira-ticket-page-link.spec`) |
| S8.2 | Open the app with the selection revealed | none | missing (reveal exists only inside the app) | e2e for in-app reveal (`mocked/reveal-test.spec`) |
| S8.3 | Jump to the source file | none | partial (file:line in description, no editor link) | none |

**S8.1 Find the page**
- Given P3 opens a React Grab ticket in Jira
- When P3 reads the description
- Then it links to the page where the comment was made (`- **Page:** [Billing settings](https://…/settings/billing)`, one line per selection; comments saved before RG-1 have no page line)

**S8.2 Reveal the selection**
- Given P3 follows the link from the ticket
- When the host app opens with React Grab
- Then the selected element is highlighted and its label is open
