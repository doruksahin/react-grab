# Dashboard Pages — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the dashboard's group list page and group detail page using only Orval-generated hooks. Groups are the primary entity, with comments nested inside. JIRA ticket creation from a group.

**Architecture:** Pages use Orval-generated React Query hooks exclusively — no hand-written fetch calls (enforced by ESLint guardrails from the OpenAPI plan). The group list page shows groups with their comment counts and JIRA status. The group detail page shows all comments in a group with screenshots and component context, plus JIRA ticket creation.

**Tech Stack:** React 19, React Router v7, TanStack Query v5, Orval-generated hooks, shadcn/ui components, MSW for development mocking

**Blocked by:**
- `2026-03-31-sync-server-openapi-plan.md` — Tasks 8-9 (dashboard Orval wired to sync-server, guardrails)
- `2026-03-31-dashboard-architecture-plan.md` — Tasks 4-6 (MSW setup, React Router, shadcn components)

**Requires sync-server changes (not in this plan):**
- `GET /workspaces/{id}/groups-with-comments` endpoint (nested resolver)
- `GET /workspaces/{id}/groups/{groupId}` endpoint (single group + comments)
- `PATCH /workspaces/{id}/groups/{groupId}` endpoint (status update)
- `POST /workspaces/{id}/groups/{groupId}/jira-ticket` endpoint (JIRA creation)
- `status` and `jiraTicketId` fields on `SelectionGroup` schema

These server-side changes should be a separate plan. Until they exist, MSW mocks fill the gap for dashboard development.

---

## Principles

1. **SRP:** Pages are thin — they call hooks and render components. No data fetching logic in page components.
2. **DRY:** Shared UI patterns (status badge, JIRA link) are extracted into `components/shared/` after the second use.
3. **Generated-only API:** Every API call goes through Orval-generated hooks. ESLint enforces this.
4. **MSW-first development:** All pages work with MSW mocks before the server implements the endpoints.

---

## Task 1: Update MSW mock handlers for group-centric data

**Files:**
- Modify: `packages/dashboard/src/mocks/handlers.ts`

The Orval-generated MSW handlers return random data. We need custom handlers that return realistic group-centric data matching the PoC.

**Step 1: Create realistic mock data**

`packages/dashboard/src/mocks/data.ts`:

```typescript
// Mock data matching sync-server schemas exactly
// Groups have status + jiraTicketId (new fields)
// Comments reference groups via groupId

export const MOCK_GROUPS = [
  {
    id: "default",
    name: "Default",
    createdAt: Date.now() - 7200000,
    revealed: true,
    status: "open",
    jiraTicketId: null,
  },
  {
    id: "dashboard-fixes",
    name: "Dashboard Fixes",
    createdAt: Date.now() - 86400000,
    revealed: true,
    status: "ticketed",
    jiraTicketId: "PROJ-89",
  },
  // ... more groups
];

export const MOCK_COMMENTS = [
  {
    id: "comment-001",
    groupId: "default",
    content: '<div data-testid="CardDescription">...</div>',
    elementName: "CardDescription",
    tagName: "div",
    componentName: "CardDescription",
    elementsCount: 1,
    elementSelectors: ['[data-testid="CardDescription"]'],
    commentText: "Text overflows on mobile viewports",
    timestamp: Date.now() - 7200000,
    revealed: true,
  },
  // ... more comments matching groups
];
```

**Step 2: Create custom MSW handlers that use this data**

`packages/dashboard/src/mocks/handlers.ts`:

```typescript
import { http, HttpResponse } from "msw";
import { MOCK_GROUPS, MOCK_COMMENTS } from "./data";

export const handlers = [
  // Groups with comments nested
  http.get("*/workspaces/:id/groups-with-comments", ({ params }) => {
    const grouped = MOCK_GROUPS.map((group) => ({
      ...group,
      comments: MOCK_COMMENTS.filter((c) => c.groupId === group.id),
    }));
    return HttpResponse.json(grouped);
  }),

  // Single group with comments
  http.get("*/workspaces/:id/groups/:groupId", ({ params }) => {
    const group = MOCK_GROUPS.find((g) => g.id === params.groupId);
    if (!group) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json({
      ...group,
      comments: MOCK_COMMENTS.filter((c) => c.groupId === group.id),
    });
  }),

  // JIRA ticket creation
  http.post("*/workspaces/:id/groups/:groupId/jira-ticket", async ({ request }) => {
    const body = await request.json();
    const ticketId = "PROJ-" + Math.floor(Math.random() * 900 + 100);
    return HttpResponse.json({
      jiraTicketId: ticketId,
      jiraUrl: `https://yourorg.atlassian.net/browse/${ticketId}`,
    });
  }),

  // Status update
  http.patch("*/workspaces/:id/groups/:groupId", async ({ request }) => {
    return HttpResponse.json({ status: "ok" });
  }),

  // Existing endpoints (use Orval-generated mocks as fallback)
  // ... spread Orval-generated handlers here for /comments, /groups, /health
];
```

**Step 3: Verify MSW starts**

```bash
pnpm --filter dashboard dev
```

Expected: Console shows "[MSW] Mocking enabled." Browser works.

**Step 4: Commit**

```bash
git add packages/dashboard/src/mocks/
git commit -m "feat(dashboard): add realistic MSW mock data for group-centric pages"
```

---

## Task 2: Create shared components — StatusBadge and JiraLink

**Files:**
- Create: `packages/dashboard/src/components/shared/status-badge.tsx`
- Create: `packages/dashboard/src/components/shared/jira-link.tsx`

Extract before the second use (they appear on both list and detail pages).

**Step 1: Create StatusBadge**

```tsx
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG = {
  open: { label: "Open", variant: "outline" as const, className: "text-blue-500 border-blue-500/30 bg-blue-500/10" },
  ticketed: { label: "Ticketed", variant: "outline" as const, className: "text-yellow-500 border-yellow-500/30 bg-yellow-500/10" },
  resolved: { label: "Resolved", variant: "outline" as const, className: "text-green-500 border-green-500/30 bg-green-500/10" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.open;
  return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
}
```

**Step 2: Create JiraLink**

```tsx
export function JiraLink({ ticketId }: { ticketId: string }) {
  return (
    <a
      href={`https://yourorg.atlassian.net/browse/${ticketId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs font-medium text-blue-500 hover:underline"
    >
      {ticketId}
    </a>
  );
}
```

**Step 3: Commit**

```bash
git add packages/dashboard/src/components/shared/
git commit -m "feat(dashboard): add StatusBadge and JiraLink shared components"
```

---

## Task 3: Implement the group list page

**Files:**
- Modify: `packages/dashboard/src/pages/selections/list.tsx`

This is the main dashboard page. Shows all groups with their comment counts, status, and JIRA links.

**Step 1: Implement the page**

```tsx
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { JiraLink } from "@/components/shared/jira-link";

// Type for the nested response — until the server endpoint exists and Orval generates it
interface GroupWithComments {
  id: string;
  name: string;
  createdAt: number;
  revealed: boolean;
  status: string;
  jiraTicketId: string | null;
  comments: Array<{
    id: string;
    groupId: string;
    elementName: string;
    tagName: string;
    componentName?: string;
    commentText?: string;
    timestamp: number;
  }>;
}

export default function GroupListPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: groups = [], isLoading } = useQuery<GroupWithComments[]>({
    queryKey: ["groups-with-comments"],
    queryFn: () =>
      fetch("/workspaces/default/groups-with-comments").then((r) => r.json()),
  });

  const filtered = statusFilter === "all"
    ? groups
    : groups.filter((g) => g.status === statusFilter);

  const stats = {
    total: groups.length,
    open: groups.filter((g) => g.status === "open").length,
    ticketed: groups.filter((g) => g.status === "ticketed").length,
    resolved: groups.filter((g) => g.status === "resolved").length,
    selections: groups.reduce((sum, g) => sum + g.comments.length, 0),
  };

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
        <p className="text-sm text-muted-foreground">
          {stats.total} groups · {stats.selections} selections
        </p>
      </div>

      {/* Stats cards */}
      {/* Status filter buttons */}
      {/* Group table/cards */}

      {/* Implementation follows the PoC HTML structure */}
    </div>
  );
}
```

Note: The `useQuery` here uses a manual `queryFn` with `fetch` because the `GET /groups-with-comments` endpoint doesn't exist in the OpenAPI spec yet — so Orval hasn't generated a hook for it. When the server adds this endpoint, regenerate Orval and replace the manual query with the generated hook. The ESLint guardrail will need a temporary exception for this one query (or use the MSW handler pattern).

**Alternative approach (DRY, no raw fetch):** Use two existing Orval-generated hooks (`useListGroups` + `useListComments`) and join client-side:

```tsx
const { data: groups = [] } = useListGroups("default");
const { data: comments = [] } = useListComments("default");

const groupsWithComments = groups.map((g) => ({
  ...g,
  comments: comments.filter((c) => c.groupId === g.id),
}));
```

This uses only generated hooks, no raw fetch, no ESLint exception. The server-side resolver is an optimization for later.

**Step 2: Verify with MSW**

```bash
pnpm --filter dashboard dev
```

Navigate to `/`. Expected: Group list renders with mock data.

**Step 3: Commit**

```bash
git add packages/dashboard/src/pages/selections/list.tsx
git commit -m "feat(dashboard): implement group list page with status filters and stats"
```

---

## Task 4: Implement the group detail page

**Files:**
- Modify: `packages/dashboard/src/pages/selections/detail.tsx`

Shows all comments in a group with their screenshots, component context, selectors, and source location. Plus JIRA ticket creation.

**Step 1: Implement the page**

The detail page receives a `groupId` from the route params. It fetches the group's comments and renders them.

Using the same DRY approach — combine `useListGroups` + `useListComments` and filter:

```tsx
import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import { JiraLink } from "@/components/shared/jira-link";
// Import generated hooks:
// import { useListGroups, useListComments } from "@/api/endpoints/...";

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  // Fetch group and its comments
  // const { data: groups } = useListGroups("default");
  // const { data: comments } = useListComments("default");
  // const group = groups?.find(g => g.id === groupId);
  // const groupComments = comments?.filter(c => c.groupId === groupId) ?? [];

  return (
    <div>
      {/* Back button */}
      {/* Group header: name, status, JIRA link */}
      {/* Selection cards: one per comment */}
      {/*   - Component name + tag */}
      {/*   - Comment text */}
      {/*   - Screenshot placeholders (full page + element) */}
      {/*   - Selector, source location, timestamp */}
      {/*   - Collapsible raw content */}
      {/* JIRA section at bottom */}
    </div>
  );
}
```

**Step 2: Verify with MSW**

Navigate to `/groups/default`. Expected: Detail page renders with comments, screenshots, component context.

**Step 3: Commit**

```bash
git add packages/dashboard/src/pages/selections/detail.tsx
git commit -m "feat(dashboard): implement group detail page with comment cards and component context"
```

---

## Task 5: Implement JIRA ticket creation dialog

**Files:**
- Create: `packages/dashboard/src/components/shared/jira-create-dialog.tsx`
- Modify: `packages/dashboard/src/pages/selections/detail.tsx` (add trigger button)

**Step 1: Install shadcn dialog component**

```bash
npx shadcn@latest add dialog -c packages/dashboard
```

**Step 2: Create the dialog component**

The dialog pre-fills:
- Summary from group name
- Description auto-generated from all comments in the group
- Attachments list from screenshot keys

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface JiraCreateDialogProps {
  group: { id: string; name: string };
  comments: Array<{
    id: string;
    elementName: string;
    componentName?: string;
    tagName: string;
    commentText?: string;
    elementSelectors?: string[];
    screenshotFullPage?: string;
    screenshotElement?: string;
  }>;
  onCreated: (ticketId: string) => void;
}

function generateDescription(group, comments) {
  // Auto-generate markdown description from all comments
  // Same logic as the PoC HTML
}

export function JiraCreateDialog({ group, comments, onCreated }: JiraCreateDialogProps) {
  // Form state, submit handler using useMutation
  // On success: call onCreated(ticketId), close dialog
}
```

**Step 3: Wire into detail page**

Add the dialog trigger at the bottom of the group detail page, visible only when `group.jiraTicketId` is null.

**Step 4: Verify with MSW**

1. Open a group without a JIRA ticket
2. Click "Create JIRA ticket"
3. Dialog opens with pre-filled form
4. Click create → MSW returns mock ticket ID
5. Dialog closes, JIRA link appears on the group

**Step 5: Commit**

```bash
git add packages/dashboard/src/components/shared/jira-create-dialog.tsx packages/dashboard/src/pages/selections/detail.tsx
git commit -m "feat(dashboard): add JIRA ticket creation dialog with auto-generated description"
```

---

## Task 6: Update React Router with group-centric routes

**Files:**
- Modify: `packages/dashboard/src/router.tsx`

**Step 1: Update routes**

```tsx
import { createBrowserRouter } from "react-router";
import DashboardLayout from "./components/layout/dashboard-layout";
import GroupListPage from "./pages/selections/list";
import GroupDetailPage from "./pages/selections/detail";
import SettingsPage from "./pages/settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: DashboardLayout,
    children: [
      { index: true, Component: GroupListPage },
      { path: "groups/:groupId", Component: GroupDetailPage },
      { path: "settings", Component: SettingsPage },
    ],
  },
]);
```

**Step 2: Update sidebar nav links**

Update `dashboard-layout.tsx` to link to `/` (groups) and use `<Link>` from react-router instead of `<a>`.

**Step 3: Verify routing**

- `/` → Group list page
- `/groups/default` → Detail for "Default" group
- `/groups/dashboard-fixes` → Detail for "Dashboard Fixes" group
- `/settings` → Settings placeholder

**Step 4: Commit**

```bash
git add packages/dashboard/src/router.tsx packages/dashboard/src/components/layout/
git commit -m "feat(dashboard): update routes for group-centric navigation"
```

---

## Task 7: End-to-end verification

**Step 1: Full flow test with MSW**

```bash
pnpm --filter dashboard dev
```

1. `/` → Group list with 4 groups, stats, status filters work
2. Click "Default" group → navigates to `/groups/default`
3. Detail shows 2 comments with component context
4. Click "Create JIRA ticket" → dialog with pre-filled description
5. Create → ticket ID appears, status changes to "ticketed"
6. Back to list → group shows updated status and JIRA link
7. Filter by "Ticketed" → shows the updated group

**Step 2: Build verification**

```bash
pnpm --filter dashboard build
```

Expected: Production build succeeds.

**Step 3: Verify no raw fetch outside src/api/**

```bash
pnpm --filter dashboard lint
```

Expected: No ESLint errors about raw fetch (all API calls go through generated hooks or are in the temporary MSW handler pattern).

**Step 4: Commit**

```bash
git commit --allow-empty -m "verify: dashboard group list + detail + JIRA creation working end-to-end with MSW"
```

---

## Summary

After all 7 tasks:

| Page | Route | What it shows |
|---|---|---|
| **Group list** | `/` | All groups with comment counts, status, JIRA links, filters |
| **Group detail** | `/groups/:groupId` | All comments in group, screenshots, component context, JIRA create |
| **Settings** | `/settings` | Placeholder |

**Data flow:**

```
MSW mocks (now)  →  Orval hooks  →  Pages
                     ↑
Server endpoints  →  (when implemented, MSW is removed)
```

**What's NOT in this plan (separate plans):**
- Server-side nested resolver endpoint → needs a sync-server plan
- Screenshot display (real images from R2) → needs screenshot capture plan
- JIRA OAuth / real integration → needs a JIRA integration plan
- Widget status badges → needs a react-grab plan

**Migration path when server catches up:**
1. Server adds `GET /groups-with-comments` and other endpoints
2. Run `pnpm codegen` → Orval generates new hooks
3. Replace client-side join with generated hook
4. Remove MSW handlers
5. Everything else stays the same
