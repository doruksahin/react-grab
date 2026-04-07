# Jira Comments in Selection Label Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface Jira ticket comments inside each `data-react-grab-selection-label` panel via a collapsible "Comments" section, hydrated from the existing per-group Jira poll.

**Architecture:** Extend the existing `getJiraTicketStatus` sync-server endpoint to include `comments[]` fetched from Jira's REST v3 issue API (`fields: ["comment"]`, ADF → plain-text). Regenerate the orval client. Thread comments through the existing `SelectionGroupWithJira` session signal and the `selection-label` props bag. Render with the already-installed shadcn-solid `Collapsible` primitive (POC scaffolding already in place).

**Tech Stack:** SolidJS + Tailwind v4 + shadcn-solid (`@kobalte/core/collapsible`), Cloudflare Workers / Hono + zod-openapi (sync-server), `jira-client` lib, orval (client codegen), Vitest (sync-server tests), Playwright (react-grab e2e).

---

## Pre-flight

- **Branch:** Already on `feat/shadow-root-threading`. Create a new branch off `main`:
  ```bash
  git checkout main && git pull && git checkout -b feat/jira-comments-in-label
  ```
  (Per saved feedback: feature branch before implementation, merge to main with `--no-ff`.)
- **Worktree:** optional but recommended via @superpowers:using-git-worktrees.
- **POC cleanup:** the mock-data collapsible currently in `selection-label/index.tsx` (added during POC) will be replaced in Task 6 — leave it in place until then so you can visually compare.

---

## Task 1: Backend — extend `JiraTicketStatus` schema with `comments[]`

**Files:**
- Modify: `packages/sync-server/src/schemas/jira.ts`
- Test: `packages/sync-server/src/schemas/__tests__/jira.test.ts` (create if missing)

**Step 1: Write the failing test**

```ts
// packages/sync-server/src/schemas/__tests__/jira.test.ts
import { describe, it, expect } from "vitest";
import { JiraTicketStatus, JiraComment } from "../jira.js";

describe("JiraComment schema", () => {
  it("parses a minimal comment", () => {
    const parsed = JiraComment.parse({
      id: "10001",
      author: "Alice",
      authorAvatar: null,
      body: "Looks good",
      createdAt: "2026-04-07T10:00:00.000Z",
    });
    expect(parsed.id).toBe("10001");
  });
});

describe("JiraTicketStatus schema", () => {
  it("includes a comments array", () => {
    const parsed = JiraTicketStatus.parse({
      status: "In Progress",
      statusCategory: "In Progress",
      assignee: null,
      reporter: null,
      assigneeAvatar: null,
      reporterAvatar: null,
      jiraUrl: "https://x/browse/ATT-1",
      labels: [],
      comments: [],
    });
    expect(parsed.comments).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/sync-server && pnpm vitest run src/schemas/__tests__/jira.test.ts
```

Expected: FAIL — `JiraComment` not exported, `comments` not on `JiraTicketStatus`.

**Step 3: Add schema**

In `packages/sync-server/src/schemas/jira.ts`, add **before** `JiraTicketStatus`:

```ts
export const JiraComment = z.object({
  id: z.string().openapi({ example: "10001" }),
  author: z.string().openapi({ example: "Alice Cooper" }),
  authorAvatar: z.string().nullable().openapi({ example: "https://x/avatar.png" }),
  body: z.string().openapi({
    description: "Plain-text rendering of the Jira ADF comment body",
    example: "Looks good to me",
  }),
  createdAt: z.string().openapi({ example: "2026-04-07T10:00:00.000Z" }),
});
```

Then extend `JiraTicketStatus`:

```ts
export const JiraTicketStatus = z.object({
  // ...existing fields...
  labels: z.array(z.string()),
  comments: z.array(JiraComment),
});
```

Also export `JiraComment` from `packages/sync-server/src/schemas/index.ts` (mirror the existing exports).

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run src/schemas/__tests__/jira.test.ts
```
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/sync-server/src/schemas/jira.ts \
        packages/sync-server/src/schemas/index.ts \
        packages/sync-server/src/schemas/__tests__/jira.test.ts
git commit -m "feat(sync-server): add JiraComment schema and comments[] on JiraTicketStatus"
```

---

## Task 2: Backend — fetch + flatten Jira comments in `JiraService.getIssueStatus`

**Files:**
- Modify: `packages/sync-server/src/services/jira.service.ts:164-179`
- Create: `packages/sync-server/src/services/__tests__/jira.service.test.ts` (or extend existing if present)

**Background:**
- The service uses [`jira-client`](https://www.npmjs.com/package/jira-client). Adding `"comment"` to `fields` returns `issue.fields.comment.comments[]`.
- Comment bodies come back as **ADF** (Atlassian Document Format). The codebase already has `markdownToAdf` (one-way). We need ADF → plain text. **Do not** pull a heavy library — write a 30-line walker that recursively flattens `text` nodes and joins paragraphs with `\n`.

**Step 1: Write the failing test**

```ts
// packages/sync-server/src/services/__tests__/jira.service.test.ts
import { describe, it, expect } from "vitest";
import { adfToPlainText } from "../jira.service.js"; // will export

describe("adfToPlainText", () => {
  it("returns empty string for null/undefined", () => {
    expect(adfToPlainText(null)).toBe("");
    expect(adfToPlainText(undefined)).toBe("");
  });

  it("flattens a single-paragraph ADF doc", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello world" }] },
      ],
    };
    expect(adfToPlainText(doc)).toBe("Hello world");
  });

  it("joins multiple paragraphs with newline", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Line one" }] },
        { type: "paragraph", content: [{ type: "text", text: "Line two" }] },
      ],
    };
    expect(adfToPlainText(doc)).toBe("Line one\nLine two");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/sync-server && pnpm vitest run src/services/__tests__/jira.service.test.ts
```
Expected: FAIL — `adfToPlainText` not exported.

**Step 3: Implement `adfToPlainText` and extend `getIssueStatus`**

In `packages/sync-server/src/services/jira.service.ts`, add at top-level (above the class):

```ts
type AdfNode = { type: string; text?: string; content?: AdfNode[] };

export function adfToPlainText(node: AdfNode | null | undefined): string {
  if (!node) return "";
  if (node.type === "text" && typeof node.text === "string") return node.text;
  if (!node.content) return "";
  const sep = node.type === "paragraph" || node.type === "doc" ? "\n" : "";
  return node.content
    .map((child) => adfToPlainText(child))
    .filter(Boolean)
    .join(sep)
    .trim();
}
```

Then change `getIssueStatus` to:

```ts
async getIssueStatus(ticketId: string) {
  const issue = await this.client.issues.getIssue({
    issueIdOrKey: ticketId,
    fields: ["status", "assignee", "reporter", "labels", "comment"],
  });

  const rawComments =
    (issue.fields.comment?.comments as Array<{
      id: string;
      author?: { displayName?: string; avatarUrls?: Record<string, string> };
      body: AdfNode;
      created: string;
    }> | undefined) ?? [];

  const comments = rawComments.map((c) => ({
    id: c.id,
    author: c.author?.displayName ?? "Unknown",
    authorAvatar: c.author?.avatarUrls?.["48x48"] ?? null,
    body: adfToPlainText(c.body),
    createdAt: c.created,
  }));

  return {
    status: issue.fields.status?.name ?? "Unknown",
    statusCategory: issue.fields.status?.statusCategory?.name ?? "Unknown",
    assignee: issue.fields.assignee?.displayName ?? null,
    reporter: issue.fields.reporter?.displayName ?? null,
    assigneeAvatar: issue.fields.assignee?.avatarUrls?.['48x48'] ?? null,
    reporterAvatar: issue.fields.reporter?.avatarUrls?.['48x48'] ?? null,
    jiraUrl: `${this.config.baseUrl}/browse/${ticketId}`,
    labels: (issue.fields.labels as string[] | undefined) ?? [],
    comments,
  };
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run src/services/__tests__/jira.service.test.ts
```
Expected: PASS.

**Step 5: Typecheck the package**

```bash
cd packages/sync-server && pnpm typecheck
```
Expected: no errors.

**Step 6: Commit**

```bash
git add packages/sync-server/src/services/jira.service.ts \
        packages/sync-server/src/services/__tests__/jira.service.test.ts
git commit -m "feat(sync-server): fetch and flatten Jira comments in getIssueStatus"
```

---

## Task 3: Backend — manual smoke test against a real Jira ticket

**No code change.** Verification only.

**Step 1: Run sync-server locally**

```bash
cd packages/sync-server && pnpm dev
```

**Step 2: Hit the endpoint**

Pick any workspace + group with a real linked Jira ticket from your local D1 (the dashboard or an existing test data). Then:

```bash
curl -s http://localhost:8787/workspaces/<WORKSPACE_ID>/groups/<GROUP_ID>/jira-status | jq '.comments'
```

**Expected:** Array of `{ id, author, authorAvatar, body, createdAt }`. `body` is plain text, no ADF JSON. If no comments exist on the ticket, expect `[]`.

**Step 3: If broken**

Use @superpowers:systematic-debugging — do not hack-fix. Common issues: `comment` field not requested, `body` is a string instead of ADF on older Jira instances (handle with `typeof body === "string" ? body : adfToPlainText(body)`).

**No commit.**

---

## Task 4: Frontend — regenerate orval client

**Files:**
- Modify (auto): `packages/react-grab/src/generated/sync-api.ts`

**Step 1: Find the orval command**

```bash
grep -rn "orval" packages/react-grab/package.json packages/sync-server/package.json
```

**Step 2: Run codegen**

Most likely:
```bash
cd packages/sync-server && pnpm openapi:export   # writes openapi.json
cd ../react-grab && pnpm api:generate            # runs orval
```

If script names differ, use the names you find in step 1. The plan `2026-03-31-orval-types-for-react-grab.md` documents this flow — consult if stuck.

**Step 3: Verify the generated type now has `comments`**

```bash
grep -A 15 "GetJiraTicketStatus200" packages/react-grab/src/generated/sync-api.ts
```

Expected: `comments: GetJiraTicketStatus200CommentsItem[]` (or inline array type) appears in the response shape.

**Step 4: Typecheck react-grab**

```bash
cd packages/react-grab && pnpm typecheck
```
Expected: pre-existing sidebar errors only (uncommitted WIP); no new errors.

**Step 5: Commit**

```bash
git add packages/react-grab/src/generated/sync-api.ts packages/sync-server/openapi.json
git commit -m "chore(react-grab): regenerate sync-api client with Jira comments"
```

---

## Task 5: Frontend — thread `jiraComments` through `SelectionGroupWithJira` and the poller

**Files:**
- Modify: `packages/react-grab/src/features/sidebar/jira-types.ts`
- Modify: `packages/react-grab/src/features/sidebar/jira-status-poller.ts` — already calls `getJiraTicketStatus`; the new field flows automatically into `onStatusUpdate`. Confirm no transformation strips it.
- Modify: wherever `onStatusUpdate` is wired (search: `onStatusUpdate:`). Whichever signal/store the sidebar uses to merge `GetJiraTicketStatus200` into the group also needs to pick up `comments`.

**Step 1: Recon — find the merge site**

```bash
grep -rn "onStatusUpdate" packages/react-grab/src --include="*.ts" --include="*.tsx"
grep -rn "createJiraStatusPoller" packages/react-grab/src --include="*.ts" --include="*.tsx"
```

Read each hit. The poller's consumer maps the API response into `SelectionGroupWithJira` — that mapping needs the new field.

**Step 2: Extend the type**

In `packages/react-grab/src/features/sidebar/jira-types.ts`, add to `SelectionGroupWithJira`:

```ts
/** Plain-text Jira comments fetched alongside status. Empty array if none. */
jiraComments?: Array<{
  id: string;
  author: string;
  authorAvatar: string | null;
  body: string;
  createdAt: string;
}>;
```

**Step 3: Map in the consumer**

In whatever file the poller hands off to the sidebar store (found in Step 1), add `jiraComments: result.comments` to the merge.

**Step 4: Typecheck**

```bash
cd packages/react-grab && pnpm typecheck
```
Expected: no new errors.

**Step 5: Commit**

```bash
git add packages/react-grab/src/features/sidebar/jira-types.ts \
        packages/react-grab/src/features/sidebar/<merge-site-file>
git commit -m "feat(react-grab): thread Jira comments through SelectionGroupWithJira"
```

---

## Task 6: Frontend — pipe comments into the selection-label panel

**Files:**
- Modify: `packages/react-grab/src/types.ts` — add to `SelectionLabelProps`:
  ```ts
  jiraComments?: ReadonlyArray<{
    id: string;
    author: string;
    authorAvatar: string | null;
    body: string;
    createdAt: string;
  }>;
  ```
- Modify: `packages/react-grab/src/components/selection-label/index.tsx` — replace POC mock array
- Modify: wherever `SelectionLabel` is rendered (search `<SelectionLabel`) — pass `jiraComments={group.jiraComments}` from the resolved group for that selection

**Step 1: Recon**

```bash
grep -rn "SelectionLabelProps\|<SelectionLabel" packages/react-grab/src --include="*.ts" --include="*.tsx" | head
```

**Step 2: Replace the POC mock**

In `selection-label/index.tsx`, find the comment `{/* POC: comments collapsible */}` and replace with:

```tsx
<Show when={(props.jiraComments?.length ?? 0) > 0}>
  <BottomSection>
    <Collapsible>
      <CollapsibleTrigger
        data-react-grab-ignore-events
        class="flex items-center justify-between w-[calc(100%+16px)] -mx-2 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent cursor-pointer"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopImmediatePropagation()}
      >
        <span>Comments ({props.jiraComments!.length})</span>
        <span class="text-[10px]">▾</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div class="flex flex-col w-[calc(100%+16px)] -mx-2 px-2 py-1 gap-1 max-h-[160px] overflow-y-auto">
          <For each={props.jiraComments}>
            {(c) => (
              <div class="text-[11px] leading-tight text-popover-foreground">
                <span class="font-medium">{c.author}: </span>
                <span class="text-muted-foreground wrap-break-word">{c.body}</span>
              </div>
            )}
          </For>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </BottomSection>
</Show>
```

Note: collapsed by default (no `defaultOpen`). Wrapped in `<Show>` so the whole BottomSection disappears when there are no comments — avoids an empty toggle.

**Step 3: Pass the prop at the call site**

At the `<SelectionLabel ... />` site found in Step 1, pass:

```tsx
jiraComments={resolvedGroup()?.jiraComments}
```

(Adjust to match the surrounding signal/store API.)

**Step 4: Typecheck**

```bash
cd packages/react-grab && pnpm typecheck
```

**Step 5: Commit**

```bash
git add packages/react-grab/src/types.ts \
        packages/react-grab/src/components/selection-label/index.tsx \
        packages/react-grab/src/<call-site-file>
git commit -m "feat(react-grab): show Jira comments in selection label collapsible"
```

---

## Task 7: E2E test — comments render and toggle

**Files:**
- Create: `packages/react-grab/e2e/jira-comments.spec.ts`

**Step 1: Read the existing fixtures**

```bash
head -120 packages/react-grab/e2e/fixtures.ts
```

Look for how a selection with a linked Jira group is set up. There may already be a fixture stubbing `getJiraTicketStatus` — extend it with `comments: [...]`. If no fixture exists, mock the network response inline via `page.route`.

**Step 2: Write the test**

```ts
import { test, expect } from "./fixtures.js";

test("renders Jira comments collapsible in selection label", async ({ page, mountAppWithJiraGroup }) => {
  // Given: a group with two stub comments
  await mountAppWithJiraGroup({
    comments: [
      { id: "1", author: "Alice", authorAvatar: null, body: "First", createdAt: "2026-04-07T10:00:00Z" },
      { id: "2", author: "Bob",   authorAvatar: null, body: "Second", createdAt: "2026-04-07T11:00:00Z" },
    ],
  });

  // When: user selects an element in the group
  await page.locator("[data-test-target]").first().click();

  // Then: collapsible trigger shows count
  const label = page.locator("[data-react-grab-selection-label]");
  await expect(label.getByText("Comments (2)")).toBeVisible();

  // And: content is hidden by default
  await expect(label.getByText("First")).toBeHidden();

  // When: trigger clicked
  await label.getByText("Comments (2)").click();

  // Then: comments appear
  await expect(label.getByText("First")).toBeVisible();
  await expect(label.getByText("Second")).toBeVisible();
});
```

**Step 3: Run**

```bash
cd packages/react-grab && pnpm test:e2e jira-comments.spec.ts
```

**Step 4: Iterate using @superpowers:systematic-debugging if it fails.** Common gotcha: collapsible animations — `toBeHidden()` may need `{ timeout: 300 }`.

**Step 5: Commit**

```bash
git add packages/react-grab/e2e/jira-comments.spec.ts packages/react-grab/e2e/fixtures.ts
git commit -m "test(react-grab): e2e for Jira comments collapsible in selection label"
```

---

## Task 8: Verification before completion

Use @superpowers:verification-before-completion. Do **not** claim done until all of these pass and you have pasted the output:

```bash
# sync-server
cd packages/sync-server && pnpm vitest run && pnpm typecheck

# react-grab
cd ../react-grab && pnpm typecheck && pnpm test:e2e jira-comments.spec.ts
```

Then a manual smoke:
1. Start sync-server (`pnpm dev` in `packages/sync-server`)
2. Start the gym/dev playground for react-grab
3. Create or pick a selection group linked to a real Jira ticket that has at least one comment
4. Hover/select an element in that group
5. Verify the "Comments (N)" toggle appears at the bottom of the selection label
6. Click — comments expand. Click again — collapse animates closed.

---

## Task 9: PR

Use @superpowers:finishing-a-development-branch. Per saved branch-workflow feedback: merge to main with `--no-ff`. Title suggestion:

> `feat: surface Jira comments inside selection label panel`

PR body must include:
- Screenshot of the collapsed and expanded states
- Note that this required a backend schema change (Task 1) and orval regen (Task 4) — reviewers should pull and re-run codegen
- Link to this plan: `docs/plans/2026-04-07-jira-comments-in-selection-label.md`

---

## Out of scope (do NOT do in this PR)

- Pagination for >50 comments (Jira default page size). If a ticket has more, we render the first page only — that's fine for v1.
- Markdown / mention rendering inside comment bodies. Plain text only for v1.
- Posting comments back to Jira. Read-only.
- Showing avatars next to each comment. The data is plumbed (`authorAvatar`) but the v1 UI ignores it.
- Real-time updates beyond the existing 30s poll.

If any of these come up during execution, write them down as follow-up issues — do not expand scope.
