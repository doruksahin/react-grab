# Dashboard PoC Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **CRITICAL:** Use Serena MCP tools for all codebase read/write operations. Do NOT use Read/Grep/Write for code.

**Goal:** Implement the dashboard PoC from `docs/scenarios/dashboard/poc-dashboard.html` as a real React app — group list page, group detail page with screenshots, and the layout shell. All API calls via Orval-generated hooks only.

**Architecture:** Pages fetch data from the live sync-server (port 8787) using Orval-generated `useListGroups` and `useListComments` hooks. Groups and comments are joined client-side by `groupId`. Screenshots are served directly from the sync-server's R2 endpoint. No MSW for PoC — real data, real screenshots.

**Tech Stack:** React 19, React Router v7, TanStack Query v5, Orval-generated hooks, shadcn/ui, Tailwind v4

---

## High-level flow

```
sync-server (D1 + R2, port 8787)
  ↓ Vite proxy (/workspaces → localhost:8787)
dashboard (Vite, port 5173)
  ↓ Orval-generated hooks
  useListGroups("workspace-id")  → Group[]
  useListComments("workspace-id") → Comment[]
  ↓ client-side join
  groups.map(g => ({ ...g, comments: comments.filter(c => c.groupId === g.id) }))
  ↓ render
  Group list page → Group detail page → Screenshot images from /workspaces/:id/screenshots/...
```

## What exists already

- Router: `/` (list), `/selections/:id` (detail), `/settings` — all placeholder TODOs
- Layout: sidebar with nav links + `<Outlet />`
- Orval hooks: `useListComments`, `useListGroups`, `useGetScreenshot`
- Generated types: `ListComments200Item`, `ListGroups200Item`
- shadcn components: table, badge, card, button, input, select, separator, dropdown-menu
- QueryClient configured, MSW wired

## Workspace ID

The dashboard needs a workspace ID for all API calls. For PoC, hardcode it as a constant. Later it becomes a selector/setting.

---

## Task 1: Fix Vite proxy port and disable MSW

**Files:**
- Modify: `packages/dashboard/vite.config.ts`
- Modify: `packages/dashboard/src/main.tsx`

**Step 1: Update Vite proxy from 3847 to 8787**

In `packages/dashboard/vite.config.ts`, change:
```ts
server: {
  proxy: {
    "/workspaces": "http://localhost:8787",
    "/health": "http://localhost:8787",
  },
},
```

**Step 2: Disable MSW for PoC — use real server**

In `packages/dashboard/src/main.tsx`, remove the MSW enablement. Replace with direct render:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Note: Keep the `mocks/` directory — MSW can be re-enabled later for tests. Just don't start it.

**Step 3: Verify — start dashboard and hit the proxy**

```bash
# Terminal 1: sync-server
pnpm --filter @react-grab/sync-server dev

# Terminal 2: dashboard
pnpm --filter dashboard dev
```

Open browser devtools, run: `fetch("/health").then(r => r.json()).then(console.log)`

Expected: `{status: "ok"}`

**Step 4: Commit**

```bash
git add packages/dashboard/vite.config.ts packages/dashboard/src/main.tsx
git commit -m "fix(dashboard): update proxy to port 8787, disable MSW for PoC — use real server"
```

---

## Task 2: Create workspace config and shared types

**Files:**
- Create: `packages/dashboard/src/lib/config.ts`
- Create: `packages/dashboard/src/lib/types.ts`

**Step 1: Create config with hardcoded workspace ID**

`packages/dashboard/src/lib/config.ts`:
```ts
/** Workspace ID — hardcoded for PoC, will become a selector later */
export const WORKSPACE_ID = "my-workspace";
```

**Step 2: Create derived types for the group-with-comments join**

`packages/dashboard/src/lib/types.ts`:
```ts
import type { ListComments200Item } from "@/api/model";
import type { ListGroups200Item } from "@/api/model";

export type Comment = ListComments200Item;
export type Group = ListGroups200Item;

/** Group with its comments joined client-side */
export interface GroupWithComments extends Group {
  comments: Comment[];
}
```

Note: `Comment` and `Group` are re-exports of Orval-generated types — NOT hand-written. `GroupWithComments` is a client-side join type that extends the generated `Group`.

**Step 3: Verify build**

```bash
pnpm --filter dashboard build
```

**Step 4: Commit**

```bash
git add packages/dashboard/src/lib/config.ts packages/dashboard/src/lib/types.ts
git commit -m "feat(dashboard): add workspace config and GroupWithComments join type"
```

---

## Task 3: Create useGroupsWithComments hook

**Files:**
- Create: `packages/dashboard/src/hooks/use-groups-with-comments.ts`

This is the **one client-side join** — combines `useListGroups` and `useListComments` into grouped data. Every page uses this hook.

**Step 1: Create the hook**

```ts
import { useListGroups } from "@/api/endpoints/groups/groups";
import { useListComments } from "@/api/endpoints/comments/comments";
import { WORKSPACE_ID } from "@/lib/config";
import type { GroupWithComments } from "@/lib/types";

export function useGroupsWithComments() {
  const groups = useListGroups(WORKSPACE_ID);
  const comments = useListComments(WORKSPACE_ID);

  const isLoading = groups.isLoading || comments.isLoading;
  const error = groups.error || comments.error;

  const data: GroupWithComments[] | undefined =
    groups.data && comments.data
      ? groups.data.data.map((group) => ({
          ...group,
          comments: comments.data.data.filter((c) => c.groupId === group.id),
        }))
      : undefined;

  return { data, isLoading, error };
}
```

Note: The Orval hooks return `{ data: { data: T[], status: number }, ... }`. The actual array is at `.data.data`. Check the exact shape by reading the generated hook's return type — adjust if the accessor path differs.

**Step 2: Verify build**

```bash
pnpm --filter dashboard build
```

**Step 3: Commit**

```bash
git add packages/dashboard/src/hooks/
git commit -m "feat(dashboard): add useGroupsWithComments hook — client-side join of groups + comments"
```

---

## Task 4: Create shared components — StatusBadge and ScreenshotImage

**Files:**
- Create: `packages/dashboard/src/components/shared/status-badge.tsx`
- Create: `packages/dashboard/src/components/shared/screenshot-image.tsx`

**Step 1: Create StatusBadge**

Derives status from comments (since group schema doesn't have status yet):

```tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  open: "text-blue-500 border-blue-500/30 bg-blue-500/10",
  ticketed: "text-yellow-500 border-yellow-500/30 bg-yellow-500/10",
  resolved: "text-green-500 border-green-500/30 bg-green-500/10",
} as const;

type Status = keyof typeof STATUS_STYLES;

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status])}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
```

**Step 2: Create ScreenshotImage**

Renders a screenshot from the sync-server R2 endpoint:

```tsx
import { WORKSPACE_ID } from "@/lib/config";

interface ScreenshotImageProps {
  screenshotKey: string;
  alt: string;
  className?: string;
}

export function ScreenshotImage({ screenshotKey, alt, className }: ScreenshotImageProps) {
  // The key is like "my-workspace/screenshots/comment-123/element.png"
  // The URL is /workspaces/{workspace}/screenshots/{selectionId}/{type}
  // Extract selectionId and type from the key
  const parts = screenshotKey.split("/");
  const type = parts[parts.length - 1]?.replace(/\.\w+$/, ""); // "element" or "full"
  const selectionId = parts[parts.length - 2];

  if (!selectionId || !type) return null;

  const src = `/workspaces/${WORKSPACE_ID}/screenshots/${selectionId}/${type}`;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
    />
  );
}
```

**Step 3: Verify build**

```bash
pnpm --filter dashboard build
```

**Step 4: Commit**

```bash
git add packages/dashboard/src/components/shared/
git commit -m "feat(dashboard): add StatusBadge and ScreenshotImage shared components"
```

---

## Task 5: Update routes to group-centric URLs

**Files:**
- Modify: `packages/dashboard/src/router.tsx`
- Modify: `packages/dashboard/src/components/layout/dashboard-layout.tsx`

**Step 1: Update router — groups are the primary entity**

```tsx
import { createBrowserRouter } from "react-router";
import DashboardLayout from "./components/layout/dashboard-layout";
import GroupListPage from "./pages/groups/list";
import GroupDetailPage from "./pages/groups/detail";
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

**Step 2: Update layout sidebar**

```tsx
import { Link, Outlet, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { WORKSPACE_ID } from "@/lib/config";

export default function DashboardLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-60 border-r border-border bg-card p-4 flex flex-col">
        <div className="text-sm font-semibold px-3 py-2 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          react-grab
        </div>

        <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-3 py-1">Review</div>
        <Link
          to="/"
          className={cn(
            "text-sm px-3 py-2 rounded-md",
            location.pathname === "/" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Groups
        </Link>

        <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-3 py-1 mt-4">Settings</div>
        <Link
          to="/settings"
          className={cn(
            "text-sm px-3 py-2 rounded-md",
            location.pathname === "/settings" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Workspace
        </Link>

        <div className="mt-auto pt-4 border-t border-border px-3 py-2">
          <div className="text-xs font-medium text-muted-foreground">{WORKSPACE_ID}</div>
          <div className="text-[11px] text-muted-foreground/60">Connected to sync-server</div>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

**Step 3: Create the new page directories**

Move/rename `pages/selections/` to `pages/groups/`:
- `pages/groups/list.tsx` (was `pages/selections/list.tsx`)
- `pages/groups/detail.tsx` (was `pages/selections/detail.tsx`)

Keep them as placeholders for now — they get implemented in Tasks 6 and 7.

**Step 4: Verify build + routing**

```bash
pnpm --filter dashboard dev
```

Navigate to `/`, `/groups/test`, `/settings` — all should render within the layout.

**Step 5: Commit**

```bash
git add packages/dashboard/src/router.tsx packages/dashboard/src/components/layout/ packages/dashboard/src/pages/
git commit -m "refactor(dashboard): group-centric routes and sidebar layout"
```

---

## Task 6: Implement group list page

**Files:**
- Modify: `packages/dashboard/src/pages/groups/list.tsx`

This implements the main page from the PoC HTML — stats cards, status filter, group cards with nested comments.

**Step 1: Implement the page**

```tsx
import { useState } from "react";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGroupsWithComments } from "@/hooks/use-groups-with-comments";
import type { GroupWithComments } from "@/lib/types";

function deriveGroupStatus(group: GroupWithComments): "open" | "ticketed" | "resolved" {
  const statuses = group.comments.map((c) => c.status).filter(Boolean);
  if (statuses.every((s) => s === "resolved")) return "resolved";
  if (statuses.some((s) => s === "ticketed")) return "ticketed";
  return "open";
}

export default function GroupListPage() {
  const { data: groups, isLoading, error } = useGroupsWithComments();
  const [filter, setFilter] = useState<"all" | "open" | "ticketed" | "resolved">("all");

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (error) return <div className="text-destructive">Error loading data</div>;
  if (!groups) return null;

  const withStatus = groups.map((g) => ({ ...g, derivedStatus: deriveGroupStatus(g) }));
  const filtered = filter === "all" ? withStatus : withStatus.filter((g) => g.derivedStatus === filter);
  const totalSelections = groups.reduce((sum, g) => sum + g.comments.length, 0);

  const stats = {
    groups: groups.length,
    selections: totalSelections,
    open: withStatus.filter((g) => g.derivedStatus === "open").length,
    ticketed: withStatus.filter((g) => g.derivedStatus === "ticketed").length,
    resolved: withStatus.filter((g) => g.derivedStatus === "resolved").length,
  };

  const filters = ["all", "open", "ticketed", "resolved"] as const;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
        <p className="text-sm text-muted-foreground">
          {stats.groups} groups · {stats.selections} selections
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: "Groups", value: stats.groups },
          { label: "Selections", value: stats.selections },
          { label: "Open", value: stats.open, color: "text-blue-500" },
          { label: "Ticketed", value: stats.ticketed, color: "text-yellow-500" },
          { label: "Resolved", value: stats.resolved, color: "text-green-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={`text-2xl font-semibold ${s.color ?? ""}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              filter === f
                ? "bg-foreground text-background border-foreground font-medium"
                : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Group cards */}
      <div className="space-y-3">
        {filtered.map((group) => (
          <Link key={group.id} to={`/groups/${group.id}`} className="block">
            <Card className="hover:border-muted-foreground/30 transition-colors cursor-pointer">
              <CardContent className="p-0">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <div className="font-semibold text-sm">{group.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {group.comments.length} selection{group.comments.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      group.derivedStatus === "open" ? "text-blue-500 border-blue-500/30 bg-blue-500/10" :
                      group.derivedStatus === "ticketed" ? "text-yellow-500 border-yellow-500/30 bg-yellow-500/10" :
                      "text-green-500 border-green-500/30 bg-green-500/10"
                    }
                  >
                    {group.derivedStatus.charAt(0).toUpperCase() + group.derivedStatus.slice(1)}
                  </Badge>
                </div>
                {/* Nested comments */}
                {group.comments.length > 0 && (
                  <div className="border-t border-border">
                    {group.comments.map((c) => (
                      <div key={c.id} className="grid grid-cols-[160px_1fr_80px] gap-3 px-5 py-2 text-xs border-t border-border/30 first:border-t-0">
                        <span className="font-mono text-purple-400 font-medium truncate">{c.componentName ?? c.elementName}</span>
                        <span className="text-muted-foreground truncate">{c.commentText ?? ""}</span>
                        <span className="text-muted-foreground font-mono text-right">&lt;{c.tagName}&gt;</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No groups match the filter.
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify with live data**

Start sync-server + dashboard, navigate to `/`. Should see real groups with real comments from the sync-server.

**Step 3: Commit**

```bash
git add packages/dashboard/src/pages/groups/list.tsx
git commit -m "feat(dashboard): implement group list page with stats, filters, nested comments"
```

---

## Task 7: Implement group detail page

**Files:**
- Modify: `packages/dashboard/src/pages/groups/detail.tsx`

Shows all comments in a group with screenshots, component context, and selectors.

**Step 1: Implement the page**

```tsx
import { useParams, Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useGroupsWithComments } from "@/hooks/use-groups-with-comments";
import { ScreenshotImage } from "@/components/shared/screenshot-image";

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { data: groups, isLoading } = useGroupsWithComments();

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  const group = groups?.find((g) => g.id === groupId);
  if (!group) return <div className="text-muted-foreground">Group not found</div>;

  return (
    <div className="max-w-4xl">
      {/* Back + header */}
      <Link to="/" className="text-xs text-muted-foreground hover:text-foreground mb-4 inline-block">
        ← Back to groups
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">{group.name}</h1>
          <p className="text-sm text-muted-foreground">
            {group.comments.length} selection{group.comments.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Comment cards */}
      <div className="space-y-4">
        {group.comments.map((comment) => {
          const sourceMatch = comment.content.match(/at \/(.+?)\)/);
          const source = sourceMatch?.[1];

          return (
            <Card key={comment.id}>
              <CardContent className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-purple-400">
                    {comment.componentName ?? comment.elementName}
                  </span>
                  <Badge variant="outline" className="text-[11px] text-muted-foreground">
                    &lt;{comment.tagName}&gt;
                  </Badge>
                </div>

                {/* Comment text */}
                {comment.commentText && (
                  <p className="text-sm text-muted-foreground italic">
                    "{comment.commentText}"
                  </p>
                )}

                {/* Screenshots */}
                {(comment.screenshotFullPage || comment.screenshotElement) && (
                  <div className="grid grid-cols-2 gap-3">
                    {comment.screenshotFullPage && (
                      <div className="border border-border rounded-lg overflow-hidden">
                        <ScreenshotImage
                          screenshotKey={comment.screenshotFullPage}
                          alt="Full page"
                          className="w-full h-48 object-cover object-top"
                        />
                        <div className="text-[11px] text-muted-foreground px-3 py-1.5 border-t border-border">
                          Full page
                        </div>
                      </div>
                    )}
                    {comment.screenshotElement && (
                      <div className="border border-border rounded-lg overflow-hidden">
                        <ScreenshotImage
                          screenshotKey={comment.screenshotElement}
                          alt="Element"
                          className="w-full h-48 object-contain bg-black/5"
                        />
                        <div className="text-[11px] text-muted-foreground px-3 py-1.5 border-t border-border">
                          Element
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Separator />

                {/* Component context */}
                <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Selector</span>
                  <span className="font-mono text-muted-foreground">{comment.elementSelectors?.[0] ?? "—"}</span>
                  {source && (
                    <>
                      <span className="text-muted-foreground">Source</span>
                      <span className="font-mono text-muted-foreground">{source}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Timestamp</span>
                  <span className="font-mono text-muted-foreground">{new Date(comment.timestamp).toLocaleString()}</span>
                </div>

                {/* Collapsible raw content */}
                <details className="text-xs">
                  <summary className="text-muted-foreground cursor-pointer">Raw content</summary>
                  <pre className="mt-2 p-3 bg-muted/50 rounded-md overflow-x-auto text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                    {comment.content}
                  </pre>
                </details>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Verify with live data**

Navigate to `/groups/default` (or whatever group ID exists). Should show real comments with real screenshots from R2.

**Step 3: Commit**

```bash
git add packages/dashboard/src/pages/groups/detail.tsx
git commit -m "feat(dashboard): implement group detail page with screenshots, component context"
```

---

## Task 8: End-to-end verification

**Step 1: Start both servers**

```bash
# Terminal 1
pnpm --filter @react-grab/sync-server dev

# Terminal 2
pnpm --filter dashboard dev
```

**Step 2: Ensure data exists**

If you haven't already, use the AdCreative app with react-grab to capture some selections. Or seed data via curl:

```bash
curl -X PUT http://localhost:8787/workspaces/my-workspace/groups \
  -H "Content-Type: application/json" \
  -d '[{"id":"default","name":"Default","createdAt":1774971000000}]'

curl -X PUT http://localhost:8787/workspaces/my-workspace/comments \
  -H "Content-Type: application/json" \
  -d '[{"id":"c1","groupId":"default","content":"<div data-testid=\"CardDescription\">Let AI craft videos</div>\n  in CardDescription (at /src/adc-ui/card/card-description.tsx:38)","elementName":"CardDescription","tagName":"div","componentName":"CardDescription","elementsCount":1,"elementSelectors":["[data-testid=\"CardDescription\"]"],"commentText":"Text overflows on mobile","timestamp":1774971146401}]'
```

**Step 3: Full flow test**

1. Open `http://localhost:5173` → Group list page loads with real groups
2. Stats cards show correct counts
3. Filter buttons work (all / open / ticketed / resolved)
4. Click a group → navigates to `/groups/{id}`
5. Detail page shows all comments in the group
6. Screenshots render from R2 (if captured)
7. Component context (selector, source, timestamp) displayed
8. Raw content collapsible works
9. Back link returns to list
10. Sidebar nav highlights current page

**Step 4: Verify build**

```bash
pnpm --filter dashboard build
```

**Step 5: Commit**

```bash
git commit --allow-empty -m "verify: dashboard PoC end-to-end — group list + detail with live data and screenshots"
```

---

## Summary

After all 8 tasks:

| Page | Route | Data source |
|---|---|---|
| Group list | `/` | `useListGroups` + `useListComments` joined client-side |
| Group detail | `/groups/:groupId` | Same hooks, filtered by groupId |
| Settings | `/settings` | Placeholder |

**What's used:**
- Orval-generated hooks: `useListGroups`, `useListComments` — no hand-written fetch
- Orval-generated types: `ListComments200Item`, `ListGroups200Item` — no hand-written API types
- Screenshots served from sync-server R2 endpoint via Vite proxy
- All data is live from D1 via the sync-server

**What's NOT in this PoC (future work):**
- JIRA ticket creation — needs server-side endpoint + JIRA API integration
- Group status/jiraTicketId on server — needs schema change
- Workspace selector — hardcoded for now
- Auth — none
- Dark mode — ThemeProvider exists but not wired into pages
