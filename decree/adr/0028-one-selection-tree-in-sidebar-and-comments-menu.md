---
date: '2026-11-16'
references:
- ADR-0022
- ADR-0008
status: accepted
---

# ADR-0028 Show selections as one tree in the sidebar and the comments menu

## Context and Problem Statement

The sidebar and the comments menu show the same selections in two shapes:

- The sidebar has two tabs. "Groups" lists one card per group. "Selections" lists every selection as one flat list, and marks each loose one "Ungrouped".
- The comments menu shows one tree: an "Ungrouped" section first, then one section per group with its selections.

A row also leads with different things: the menu with the component name, the sidebar with the comment. People who use both read two vocabularies for one model (ADR-0008: a selection is in a group, or is loose and can get a ticket of its own).

## Considered Options

1. **One tree in both.** The sidebar takes the menu's structure and draws it with the menu's own section components. Every selection keeps its full sidebar card under its section.
2. **Two views in both.** The menu gets the sidebar's Groups | Selections switch.
3. **Rename and align rows only.** The structures stay different.

## Decision Outcome

Chosen option: **1**, by the user on 2026-11-16 (design proposal "Selections, One Structure").

- **One projection.** Both surfaces sort selections with `isPresentedAsLoose` and `groupComments(presentedGroups(...))`: Ungrouped first, then each group, empty groups included.
- **One set of section components.** `UngroupedSection` and `GroupCollapsible` draw the sections in both. The sidebar passes extra header content to `GroupCollapsible` (the ticket status and "Open detail view"; the ticket key, people and labels are on each card and in the detail view); the menu passes none.
- **Full cards stay.** In the sidebar each selection keeps its card (ticket, Jira comments, group picker, bulk select, remove). Only where it sits changes.
- **The tabs go.** Search and "Flagged only" pick selections: a section with no match hides. The status chips and the filter menu pick groups: a matching group shows even when it is empty. The group detail view stays.
- **Sections keep their state.** Sections are keyed by group id, so a data change does not close a section or reset its cards. A focus request ("Open thread") opens the section that holds the selection.
- **One row reading.** A row's title is the comment, falling back to the component; the component is the secondary line. One function (`selectionRowFields`) gives the menu row both lines and the sidebar card its title.

### Consequences

- Good: one structure and one vocabulary; the two surfaces cannot drift apart, because they share the code that draws them.
- Good: no feature is lost. A group header shows the ticket status; the ticket key, assignee and reporter, which the Groups tab's cards showed, are on each card and in the group detail view.
- Note: the sidebar headers now have the eye toggle, and the sidebar's filters also set which groups are shown on the page. A filter change replaces a manual toggle, as before in the menu.
- Bad: a long tree needs more scrolling than a tab of group cards. The sections collapse.
- Neutral: the Groups-tab components (`GroupList`, `GroupCard`, `GroupChildren`) are removed.

### Update: rows for long lists (2026-11-16)

The "Bad" consequence above, a long tree needs a lot of scrolling, is addressed by the design proposal "Kenar Çubuğu Ölçek Önerisi", chosen by the user on 2026-11-16. The tree and its sections stay; how a selection sits in them changes.

- **A row, then the card.** In the sidebar each selection is a short row (status dot, comment, element, ticket key, location, flag, replay) whose full card opens underneath; one card is open at a time (`components/sidebar/selection-row.tsx`, Kobalte Collapsible). A focus request opens and scrolls to the card. Kobalte Accordion was not used: its list handling consumes Escape, so Escape would no longer close the sidebar.
- **Chips count rows.** A selection's status is its ticket's (its group's, or its own synthetic group's); no ticket is "No Task". The status chips count and narrow selections, so "All" equals the rows in the list, and loose selections with a ticket are counted. An "Attention" chip narrows to the flagged ones and the ones known not to be on this page (an unknown page, on old data, does not count). The filter menu's assignee, reporter, label and due date and "Flagged only" pick as before. A status, from a chip or from the filter menu (one shared filter), now picks selections: "No Task" includes loose selections without a ticket, and a group with that status but no selections no longer shows while the status is chosen.
- **Grouping and order.** The list groups by group (this ADR's tree) or by status, and orders each section with the selections that need attention first, or newest first.
- **Headers stay.** Section headers stick while their section scrolls; Ungrouped shows how many of its selections are in each status.
- **Comments start closed** on a card, except on a card opened by a focus request ("Open thread").
- The rules are pure functions in `features/sidebar/business/` (`selectionStatus`, `needsAttention`, `orderSelections`, `sectionsByStatus`, `getStatusFilterOptions`), and `useSidebarSelections` computes the list once for the chips and the panel.

### Update: from the comments menu to the sidebar (2026-11-16)

The comments menu is the quick list; the full card lives in the sidebar. A row's ⋯ menu has "Open in sidebar", which closes the menu and opens the sidebar on that selection's card (the same focus request as a pin's "Open thread"), and the menu's header has an "Open in sidebar" button that opens the sidebar plainly.
