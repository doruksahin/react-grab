# Dashboard — Motivation

## Why a dashboard?

react-grab is a capture tool. It lives inside the host app as a lightweight overlay. Its job is to let developers and QA select elements, annotate them, and persist that data to a shared workspace.

But capturing is only half the story. Once selections exist, someone needs to review them, act on them, and track what happened. That someone is usually a PM — and the widget is the wrong place for that workflow.

## What the widget can't do well

### Screen real estate

react-grab is a floating panel inside someone else's app. There's no room for:
- Tables of selections across multiple pages
- Side-by-side screenshot comparisons
- JIRA ticket forms with assignee, sprint, priority, labels
- Filtering and search across a workspace

### Cross-page visibility

The widget only sees the current page. A PM reviewing feedback needs to see all selections across the entire workspace — grouped by page, component, status, or date.

### PM workflow mismatch

To use the widget, a PM must:
1. Have the app running locally or on staging
2. Navigate to the exact page where selections were made
3. Use the react-grab overlay (which they may not be familiar with)

This is a developer tool being forced into a PM workflow. It doesn't fit.

### Scope creep risk

Adding JIRA forms, ticket management, filtering, bulk operations, and status tracking to react-grab would bloat the widget. It would grow from a focused capture tool into a project management sidebar. Every feature added to the widget is code running inside the host app — increasing bundle size, risking style collisions, and complicating the API surface.

## What a dashboard solves

A separate dashboard app reads from the same data store (D1 + R2) and provides:

| Capability | Why it needs a dashboard |
|---|---|
| Full selection list with filters | Tables, pagination, search — needs a full page |
| Screenshot review | Full-page + element crops side by side, zoomable |
| React ancestor tree + state dump | Collapsible tree views, syntax highlighting |
| JIRA ticket creation | Pre-filled from selection data, with full JIRA field support |
| Ticket status tracking | Which selections are open, ticketed, or resolved |
| Bulk operations | "Create tickets for these 5 selections" |
| Cross-workspace view | Multiple workspaces, multiple projects |
| Role-based access | PMs see review UI, devs see technical detail |

## The separation principle

```
react-grab (widget)     →  Captures selections, uploads screenshots
                            Shows lightweight status badges per selection
                            Stays lean, stays focused

Dashboard (app)         →  Reviews, manages, acts on selections
                            JIRA integration, filtering, bulk ops
                            Full-page UI for PM workflows
```

The widget captures. The dashboard manages. They share the same backend (D1 for structured data, R2 for screenshots) but serve different users with different needs.

## What triggered this

The sync server (`packages/sync-server/`) already persists selections to a shared workspace. Today it stores flat JSON files on disk. As we add richer data to selections — screenshots, react ancestor dumps, state snapshots, JIRA links — the storage needs outgrow flat files. Moving to D1 + R2 gives us relational queries and blob storage. Once data is queryable, a dashboard becomes a natural next step — not a new requirement, but the obvious interface for the data we're already collecting.
