# Dashboard Roadmap

## Vision

react-grab captures element selections inside the host app. Today that data lives in flat JSON files on a sync server. We want to turn these captures into actionable artifacts — richer data, a review dashboard for PMs, and JIRA integration to close the loop between feedback and tickets.

---

## MVP — the first demo

The MVP collapses phases 0–3 into one deliverable with a reduced scope at each layer. Goal: "Select an element, add a comment, click create — JIRA ticket with screenshots and component context. Zero manual work."

### What's in

| Layer | MVP scope | Cut from full phase |
|---|---|---|
| **Storage** | D1 schema (selections + groups), R2 bucket for screenshots, Drizzle ORM, deploy as Worker | — |
| **Capture enrichment** | Full-page + element screenshots uploaded to R2, page URL/title | React ancestor chain, impair state dump, source location |
| **Dashboard** | Selection list (status filter only), selection detail (screenshots + component info), basic workspace picker | Advanced filters, cross-workspace view, auth/roles |
| **JIRA integration** | One-click ticket creation with pre-filled description + auto-attached screenshots, JIRA link visible on selection | Bulk operations, JIRA webhook for status sync, OAuth (use API token) |

### What's out

- Auth / roles — single workspace, no login
- Bulk operations — one ticket at a time
- JIRA status sync — manual status update, no webhooks
- Widget status badge — dashboard-only for MVP
- Impair state dump — plugin work, low demo impact
- React ancestor tree — include if trivial, not a blocker
- Advanced filters — status filter is enough

### Demo script

1. Open host app with react-grab → select element → add comment
2. Screenshots captured automatically, uploaded to R2
3. Open dashboard → selection appears with screenshots + component context
4. Click "Create JIRA ticket" → pre-filled form → hit create
5. JIRA ticket exists with screenshots attached
6. Dashboard shows JIRA link on the selection

### MVP build order

```
1. D1 schema + R2 bucket + Drizzle setup          (storage foundation)
2. Migrate sync-server routes to D1/R2             (existing API keeps working)
3. Screenshot capture in react-grab + R2 upload    (the visual wow)
4. Dashboard: selection list page                  (shows it's a platform)
5. Dashboard: selection detail page                (screenshots + context)
6. JIRA ticket creation from detail page           (the money shot)
7. JIRA link displayed on selection row            (closes the loop)
```

---

## Full roadmap

### Phase 0: Storage migration

Move from flat JSON files to a real data layer.

- Replace `sync-server` file storage with **Cloudflare D1** (serverless SQLite)
- Add **Cloudflare R2** for blob storage (screenshots)
- Use **Drizzle ORM** for type-safe schema and migrations
- Deploy sync-server as a **Cloudflare Worker** (Hono already supports this)
- Existing react-grab clients continue working — same HTTP API, new backend

**Why first:** Everything else depends on queryable, structured storage.

### Phase 1: Enrich selection captures

Capture more context at selection time, inside react-grab.

- Serialize and persist **react ancestor chain** (fiber tree walking already exists)
- Capture **full-page screenshot** and **element screenshot**, upload to R2
- Add **page URL and title** to each selection
- Add **impair state dump** via plugin hook
- Persist **source location** when instrumentation is active

**Why second:** The dashboard needs rich data to display. No point building a UI for thin data.

### Phase 2: Dashboard — read-only

A separate web app that reads from D1/R2 and displays selections.

- Selection list with filters (by workspace, page, component, status, date)
- Selection detail view: screenshots, react ancestor tree, state dump, source location
- Cross-page, cross-workspace visibility
- Basic auth (who can see what)

**Why read-only first:** Validate the UI and data model before adding write operations. PMs can start reviewing immediately.

### Phase 3: Dashboard — ticket management

Add write capabilities and JIRA integration.

- Create JIRA ticket from a selection (pre-filled with context, screenshots attached)
- Selection status lifecycle: open → ticketed → resolved
- Bulk operations (create tickets for multiple selections)
- Deep link from JIRA ticket back to selection in dashboard
- Deep link from react-grab widget to selection in dashboard

### Phase 4: Widget integration

Lightweight status feedback inside react-grab.

- Show ticket status badge per selection (open / JIRA-456 / resolved)
- Clickable link to dashboard detail view
- No JIRA forms in the widget — just status indicators

---

## Tech stack

| Layer | Technology | Reason |
|---|---|---|
| Sync server | **Hono on Cloudflare Workers** | Already using Hono, native Workers support |
| Structured data | **Cloudflare D1** | Relational queries, native Workers binding, SQLite |
| Blob storage | **Cloudflare R2** | Screenshots, zero egress, S3-compatible |
| ORM | **Drizzle** | Type-safe, Workers-compatible, D1 + R2 support |
| Dashboard app | TBD (likely Hono + SSR or Next.js) | Needs evaluation in Phase 2 |
| JIRA integration | JIRA REST API | Standard, well-documented |

## What we're not doing

- **Real-time collaboration** — no WebSockets, no CRDTs, no operational transforms. Full-replacement sync is fine for now.
- **Auth in Phase 0–1** — open workspace model continues. Auth comes with the dashboard.
- **Offline support** — server is the source of truth. No local-first sync.
- **Mobile** — dashboard is desktop-only for now.

## Open questions

- Dashboard tech: SSR with Hono, or a separate Next.js/Vite app?
- Screenshot capture method: html2canvas, dom-to-image, or browser API?
- Identity: do we need user accounts, or is a display name enough?
- JIRA auth: OAuth app, API token per workspace, or service account?
