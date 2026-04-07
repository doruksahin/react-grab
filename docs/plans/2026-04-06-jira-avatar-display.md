# Jira Avatar Display Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface Jira user profile pictures (48×48 avatar URLs) alongside assignee/reporter display names in sidebar group cards and the group detail view.

**Architecture:** Extend the existing 30-second Jira status poll pipeline — extract `avatarUrls['48x48']` from the already-fetched jira.js user objects, propagate through the Zod schema → generated types → group signal, and render with a new `UserAvatar` SolidJS component that falls back to initials when no image is available.

**Tech Stack:** TypeScript, Hono + Zod (sync-server), SolidJS + Tailwind (react-grab), jira.js v5, Playwright (e2e tests), Orval (codegen)

> **Note on tests:** This project has no unit test runner (no vitest/jest). All tests are Playwright e2e. The "test" steps in this plan use TypeScript type-checking (`pnpm typecheck`) as the compile-time safety net, and Playwright for behaviour verification.

---

### Task 1: Extract avatar URLs in `getIssueStatus`

**Files:**
- Modify: `packages/sync-server/src/services/jira.service.ts:164-177`

**Step 1: Read the current implementation**

Open `packages/sync-server/src/services/jira.service.ts` at lines 164–177. The `getIssueStatus` method returns 6 fields. `issue.fields.assignee` and `issue.fields.reporter` are jira.js `UserDetails` objects — they already carry `avatarUrls?: { '16x16'?: string; '24x24'?: string; '32x32'?: string; '48x48'?: string }`. We just aren't extracting it.

**Step 2: Add the two avatar fields**

Replace the `return` block inside `getIssueStatus` (lines 169–176):

```ts
return {
  status: issue.fields.status?.name ?? "Unknown",
  statusCategory: issue.fields.status?.statusCategory?.name ?? "Unknown",
  assignee: issue.fields.assignee?.displayName ?? null,
  reporter: issue.fields.reporter?.displayName ?? null,
  assigneeAvatar: issue.fields.assignee?.avatarUrls?.['48x48'] ?? null,
  reporterAvatar: issue.fields.reporter?.avatarUrls?.['48x48'] ?? null,
  jiraUrl: `${this.config.baseUrl}/browse/${ticketId}`,
  labels: (issue.fields.labels as string[] | undefined) ?? [],
};
```

No change to the `getIssue` call — `fields: ["status", "assignee", "reporter", "labels"]` already returns the full user object including `avatarUrls`.

**Step 3: Type-check**

```bash
cd packages/sync-server && pnpm tsc --noEmit 2>&1
```

Expected: 0 errors. The jira.js `UserDetails` type already declares `avatarUrls`, so TypeScript will infer correctly.

**Step 4: Commit**

```bash
git add packages/sync-server/src/services/jira.service.ts
git commit -m "feat(jira-service): extract avatarUrls from assignee and reporter in getIssueStatus"
```

---

### Task 2: Update the Zod schema and regenerate frontend types

**Files:**
- Modify: `packages/sync-server/src/schemas/jira.ts:30-37`
- Modify: `packages/react-grab/src/generated/sync-api.ts:197-206`

**Step 1: Update `JiraTicketStatus` schema**

In `packages/sync-server/src/schemas/jira.ts`, the `JiraTicketStatus` object currently has 6 fields. Add two more after `reporter`:

```ts
export const JiraTicketStatus = z.object({
  status: z.string(),
  statusCategory: z.string(),
  assignee: z.string().nullable(),
  reporter: z.string().nullable(),
  assigneeAvatar: z.string().nullable(),
  reporterAvatar: z.string().nullable(),
  jiraUrl: z.string(),
  labels: z.array(z.string()),
});
```

**Step 2: Regenerate the OpenAPI spec and frontend types**

```bash
cd /path/to/repo && pnpm --filter react-grab codegen 2>&1
```

This runs `export-spec` (sync-server) then `orval` (react-grab). It will overwrite `packages/react-grab/src/generated/sync-api.ts`.

Expected: the command exits 0 and the git diff on `sync-api.ts` shows `assigneeAvatar` and `reporterAvatar` added to `GetJiraTicketStatus200`.

**Step 3: Verify the generated type manually**

Open `packages/react-grab/src/generated/sync-api.ts` and confirm `GetJiraTicketStatus200` now reads:

```ts
export type GetJiraTicketStatus200 = {
  status: string;
  statusCategory: string;
  /** @nullable */
  assignee: string | null;
  /** @nullable */
  reporter: string | null;
  /** @nullable */
  assigneeAvatar: string | null;
  /** @nullable */
  reporterAvatar: string | null;
  jiraUrl: string;
  labels: string[];
};
```

> **If codegen fails or the repo doesn't have the server running:** hand-edit `sync-api.ts` directly to match the type above. The generated file can be edited manually — other fields have been added this way before.

**Step 4: Type-check the whole monorepo**

```bash
pnpm typecheck
```

Expected: 0 errors. If TypeScript complains about `assigneeAvatar` being used before it's on the type — that means Step 3 didn't apply correctly.

**Step 5: Commit**

```bash
git add packages/sync-server/src/schemas/jira.ts packages/react-grab/src/generated/sync-api.ts
git commit -m "feat(schema): add assigneeAvatar and reporterAvatar to JiraTicketStatus"
```

---

### Task 3: Propagate avatar fields through the group signal

**Files:**
- Modify: `packages/react-grab/src/features/sidebar/jira-types.ts:9-22`
- Modify: `packages/react-grab/src/core/index.tsx:3857-3874`

**Step 1: Extend `SelectionGroupWithJira`**

In `packages/react-grab/src/features/sidebar/jira-types.ts`, add two fields after `jiraReporter`:

```ts
export type SelectionGroupWithJira = SelectionGroup & {
  /** Raw JIRA status name, e.g. "In Progress" */
  jiraStatus?: string;
  /** JIRA status category, e.g. "In Progress", "Done", "To Do" */
  jiraStatusCategory?: string;
  /** Full JIRA ticket URL, e.g. "https://company.atlassian.net/browse/ATT-123" */
  jiraUrl?: string;
  /** JIRA assignee display name, null if unassigned */
  jiraAssignee?: string | null;
  /** JIRA reporter display name, null if unknown */
  jiraReporter?: string | null;
  /** Avatar URL (48×48) for the Jira assignee, null if unassigned or unavailable */
  jiraAssigneeAvatar?: string | null;
  /** Avatar URL (48×48) for the Jira reporter, null if unavailable */
  jiraReporterAvatar?: string | null;
  /** JIRA labels array, e.g. ["UI Ticket Manager", "frontend"] */
  jiraLabels?: string[];
};
```

**Step 2: Map the avatar fields in `onStatusUpdate`**

In `packages/react-grab/src/core/index.tsx` at line ~3862, the group spread currently maps 6 status fields. Add the two avatar fields:

```ts
onStatusUpdate: (groupId, status) => {
  const resolved = status.statusCategory.toLowerCase() === "done";
  const updated = selectionGroups.groups().map((g) =>
    g.id === groupId
      ? {
          ...g,
          jiraStatus: status.status,
          jiraStatusCategory: status.statusCategory,
          jiraAssignee: status.assignee,
          jiraReporter: status.reporter,
          jiraAssigneeAvatar: status.assigneeAvatar,
          jiraReporterAvatar: status.reporterAvatar,
          jiraLabels: status.labels,
          jiraResolved: resolved,
          jiraUrl: status.jiraUrl,
        }
      : g,
  );
  selectionGroups.persistGroups(updated);
},
```

**Step 3: Type-check**

```bash
pnpm typecheck
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add packages/react-grab/src/features/sidebar/jira-types.ts packages/react-grab/src/core/index.tsx
git commit -m "feat(jira-types): add jiraAssigneeAvatar and jiraReporterAvatar to group signal"
```

---

### Task 4: Create the `UserAvatar` SolidJS component

**Files:**
- Create: `packages/react-grab/src/components/sidebar/UserAvatar.tsx`

**Step 1: Create the component file**

```tsx
import { type Component, createSignal, Show } from "solid-js";

interface UserAvatarProps {
  avatarUrl: string | null | undefined;
  displayName: string | null | undefined;
  size?: number;
}

function getInitials(name: string | null | undefined): string {
  if (!name?.trim()) return "";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

export const UserAvatar: Component<UserAvatarProps> = (props) => {
  const size = () => props.size ?? 24;
  const [imgFailed, setImgFailed] = createSignal(false);

  const showImg = () => !!props.avatarUrl && !imgFailed();
  const initials = () => getInitials(props.displayName);

  return (
    <Show when={props.avatarUrl || props.displayName}>
      <Show
        when={showImg()}
        fallback={
          <Show when={initials()}>
            <div
              style={{
                width: `${size()}px`,
                height: `${size()}px`,
                "border-radius": "50%",
                background: "#64748b",
                color: "#fff",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                "font-size": `${Math.floor(size() * 0.42)}px`,
                "font-weight": "600",
                "flex-shrink": "0",
              }}
            >
              {initials()}
            </div>
          </Show>
        }
      >
        <img
          src={props.avatarUrl!}
          width={size()}
          height={size()}
          style={{ "border-radius": "50%", "flex-shrink": "0" }}
          onError={() => setImgFailed(true)}
          alt={props.displayName ?? ""}
        />
      </Show>
    </Show>
  );
};
```

**Step 2: Type-check**

```bash
pnpm typecheck
```

Expected: 0 errors.

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/sidebar/UserAvatar.tsx
git commit -m "feat(sidebar): add UserAvatar component with initials fallback"
```

---

### Task 5: Wire `UserAvatar` into `group-card.tsx`

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/group-card.tsx:46-58`

**Step 1: Understand the current structure**

Lines 46–58 of `group-card.tsx` render a `<Show>` block for `jiraAssignee` and `jiraReporter`. Each is a `<span>` with an emoji prefix (`👤`, `✏️`). We'll replace each emoji with a `<UserAvatar>` and wrap each row in a flex container.

**Step 2: Import `UserAvatar`**

At the top of `group-card.tsx`, add the import:

```ts
import { UserAvatar } from "./UserAvatar.js";
```

**Step 3: Replace the assignee/reporter block**

Replace lines 46–59 with:

```tsx
<Show when={props.entry.group.jiraAssignee || props.entry.group.jiraReporter}>
  <div class="flex gap-3 text-[11px] mb-2">
    <Show when={props.entry.group.jiraAssignee}>
      <span class="flex items-center gap-1.5 text-[10px] text-white/50">
        <UserAvatar
          avatarUrl={(props.entry.group as SelectionGroupWithJira).jiraAssigneeAvatar}
          displayName={props.entry.group.jiraAssignee}
          size={16}
        />
        {props.entry.group.jiraAssignee}
      </span>
    </Show>
    <Show when={props.entry.group.jiraReporter}>
      <span class="flex items-center gap-1.5 text-[10px] text-white/30">
        <UserAvatar
          avatarUrl={(props.entry.group as SelectionGroupWithJira).jiraReporterAvatar}
          displayName={props.entry.group.jiraReporter}
          size={16}
        />
        {props.entry.group.jiraReporter}
      </span>
    </Show>
  </div>
</Show>
```

You'll also need to import `SelectionGroupWithJira` at the top:

```ts
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
```

> **Why `size={16}`?** Group cards are compact. 16px fits better than 24px next to 10px text.

**Step 4: Type-check**

```bash
pnpm typecheck
```

Expected: 0 errors.

**Step 5: Commit**

```bash
git add packages/react-grab/src/components/sidebar/group-card.tsx
git commit -m "feat(group-card): show UserAvatar next to assignee and reporter names"
```

---

### Task 6: Wire `UserAvatar` into `detail-header.tsx`

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/detail-header.tsx:59-68`

**Step 1: Understand the current structure**

Lines 59–68 show `jiraAssignee` and `jiraReporter` as `<span>` elements with emoji prefixes inside a flex row (lines 49–69). The pattern is identical to group-card.

**Step 2: Import `UserAvatar`**

```ts
import { UserAvatar } from "./UserAvatar.js";
```

**Step 3: Replace the assignee/reporter spans**

Replace lines 59–68 with:

```tsx
<Show when={groupWithJira().jiraAssignee}>
  <span class="flex items-center gap-1.5 text-[10px] text-white/50">
    <UserAvatar
      avatarUrl={groupWithJira().jiraAssigneeAvatar}
      displayName={groupWithJira().jiraAssignee}
      size={16}
    />
    {groupWithJira().jiraAssignee}
  </span>
</Show>
<Show when={groupWithJira().jiraReporter}>
  <span class="flex items-center gap-1.5 text-[10px] text-white/30">
    <UserAvatar
      avatarUrl={groupWithJira().jiraReporterAvatar}
      displayName={groupWithJira().jiraReporter}
      size={16}
    />
    {groupWithJira().jiraReporter}
  </span>
</Show>
```

**Step 4: Type-check**

```bash
pnpm typecheck
```

Expected: 0 errors.

**Step 5: Commit**

```bash
git add packages/react-grab/src/components/sidebar/detail-header.tsx
git commit -m "feat(detail-header): show UserAvatar next to assignee and reporter names"
```

---

### Task 7: Update E2E tests

**Files:**
- Modify: `packages/react-grab/e2e/sidebar.spec.ts:295-304`

**Step 1: Update the `jira-status` mock to include avatars**

Find `setupJiraMocks` in `sidebar.spec.ts` (around line 253). The mock at line 295 for `**/groups/*/jira-status` currently returns only `status` and `statusCategory`. Update it to include the full response shape:

```ts
await page.route("**/groups/*/jira-status", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      status: "In Progress",
      statusCategory: "In Progress",
      assignee: "Jane Doe",
      reporter: "John Smith",
      assigneeAvatar: "https://example.com/avatar-jane.png",
      reporterAvatar: null,
      jiraUrl: "https://test.atlassian.net/browse/ATT-42",
      labels: [],
    }),
  }),
);
```

Note: `reporterAvatar: null` is intentional — it lets us test both code paths (img + initials fallback) in a single mock.

**Step 2: Add avatar assertions to the existing Jira status test**

Find the test that calls `setupJiraMocks` and checks the group card. After the status poll resolves (there's likely a `waitFor` or assertion on the status badge), add:

```ts
// Avatar renders for assignee (has URL)
const assigneeAvatar = await page.evaluate((attrName) => {
  const host = document.querySelector(`[${attrName}]`);
  const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
  const card = root?.querySelector("[data-react-grab-group-card]");
  return card?.querySelector("img")?.getAttribute("src") ?? null;
}, ATTR);
expect(assigneeAvatar).toBe("https://example.com/avatar-jane.png");

// Initials fallback renders for reporter (null URL)
const reporterInitials = await page.evaluate((attrName) => {
  const host = document.querySelector(`[${attrName}]`);
  const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
  const card = root?.querySelector("[data-react-grab-group-card]");
  // Find the reporter span (second user row) — look for "JS" initials
  const spans = card?.querySelectorAll(".text-white\\/30");
  for (const span of spans ?? []) {
    const div = span.querySelector("div");
    if (div?.textContent?.trim() === "JS") return true;
  }
  return false;
}, ATTR);
expect(reporterInitials).toBe(true);
```

> **Tip:** If finding elements by class selector inside shadow DOM is fragile, add `data-testid="assignee-avatar"` and `data-testid="reporter-avatar-fallback"` attributes to the `<img>` and fallback `<div>` in `UserAvatar.tsx`, then use `[data-testid='assignee-avatar']` in the selector.

**Step 3: Run the E2E tests**

```bash
cd packages/react-grab && pnpm test 2>&1 | tail -30
```

Expected: all tests pass including the new avatar assertions. If a test fails with a selector error, use the `data-testid` approach from the tip above.

**Step 4: Commit**

```bash
git add packages/react-grab/e2e/sidebar.spec.ts
git commit -m "test(e2e): assert avatar img and initials fallback in group card after status poll"
```

---

### Task 8: Mark SPEC-008 as implemented

**Step 1: Verify all acceptance criteria are met**

Run a final typecheck and E2E pass:

```bash
pnpm typecheck && pnpm --filter react-grab test
```

Expected: 0 type errors, all Playwright tests pass.

**Step 2: Check off acceptance criteria in the SPEC**

Open `decree/spec/008-jira-assignee-and-reporter-avatar-display.md` and tick every `- [ ]` that is now complete.

**Step 3: Run `decree progress`**

```bash
decree progress 2>&1 | grep SPEC-008
```

Expected: `SPEC-008  ...  100% (N/N)`

**Step 4: Transition SPEC-008 to implemented**

```bash
decree status SPEC-008 implement
```

**Step 5: Run `decree lint`**

```bash
decree lint
```

Expected: `✓ N documents validated. 0 errors.`

**Step 6: Final commit**

```bash
git add decree/spec/008-jira-assignee-and-reporter-avatar-display.md
git commit -m "chore(decree): mark SPEC-008 implemented — Jira avatar display complete"
```
