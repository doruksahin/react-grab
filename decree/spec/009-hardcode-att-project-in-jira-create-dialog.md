---
date: '2026-04-06'
references:
- SPEC-003
- ADR-0006
- PRD-002
status: implemented
---

# SPEC-009 Hardcode ATT project in JIRA create dialog

## Overview

Amends SPEC-003's JIRA create dialog to remove the project selector and hardcode the project key via config. The project key is passed through `SyncConfig.jiraProjectKey` (required when sync is enabled). Issue types and priorities load immediately for that project — no user selection step needed for project.

This is ATT-specific per ADR-0006 but implemented as a configurable `jiraProjectKey` parameter so the value isn't scattered as a magic string.

## Technical Design

### 1. Add `jiraProjectKey` to `SyncConfig`

**File:** `packages/react-grab/src/features/sync/types.ts` (line 29-37)

```typescript
// Current:
export interface SyncConfig {
  enabled: boolean;
  serverUrl: string;
  workspace: string;
  syncRevealedState: boolean;
  onSyncError: (error: Error) => void;
  options?: import("../../types.js").Options;
}

// Add after `workspace`:
  jiraProjectKey: string;
```

The field is required (not optional) — when sync is enabled, the caller must specify which JIRA project to use. This avoids silent fallback behavior.

### 2. Store `jiraProjectKey` on `syncState` and pass to sidebar

**File:** `packages/react-grab/src/core/index.tsx`

The module-level `syncState` (line 220) gains `jiraProjectKey`:

```typescript
// Current (line 220):
let syncState: { workspace: string; serverUrl: string; status: "local" | "synced" | "error" } | null = null;

// Change to:
let syncState: { workspace: string; serverUrl: string; jiraProjectKey: string; status: "local" | "synced" | "error" } | null = null;
```

All three assignments (lines 235, 245, 251) add `jiraProjectKey: config.jiraProjectKey`.

Pass to sidebar as a new prop (~line 4471):

```typescript
<Sidebar
  ...
  jiraProjectKey={syncState?.jiraProjectKey}
  ...
/>
```

### 3. Add `jiraProjectKey` to `SidebarProps`

**File:** `packages/react-grab/src/types.ts` (around line 593)

```typescript
// Add alongside syncWorkspace, syncServerUrl:
  jiraProjectKey?: string;
```

### 4. Thread `jiraProjectKey` to `JiraCreateForm`

**File:** `packages/react-grab/src/components/sidebar/jira-create-form.tsx`

Add to `JiraCreateFormProps` (line 20-28):

```typescript
interface JiraCreateFormProps {
  workspaceId: string;
  groupId: string;
  group: SelectionGroupWithJira;
  commentItems: CommentItem[];
  jiraProjectKey: string;  // NEW — required
  onSuccess: (groupId: string, ticketId: string, ticketUrl: string) => void;
  onClose: () => void;
}
```

The parent component (`group-detail-view.tsx`) passes `props.jiraProjectKey` down from its own props.

### 5. One-way data flow: Loading → Validate → Form (or Error)

**File:** `packages/react-grab/src/components/sidebar/jira-create-form.tsx`

The current form mixes data loading with form rendering — signals react to async state changes. Replace this with a three-phase architecture: a **loader** component fetches and validates, then renders either the **form** (data guaranteed) or an **error**.

```
JiraCreateForm (entry point)
  ├── Loading…          ← while resources pending
  ├── Error             ← "Task" or "Medium" not found in API response
  └── JiraCreateFormReady  ← data validated, defaults guaranteed
```

**Remove** (lines 11, 42-44):
- `listJiraProjects` import
- `projects` resource

**Restructure** the component into loader + ready form:

```typescript
const DEFAULT_ISSUE_TYPE = "Task";
const DEFAULT_PRIORITY = "Medium";

export const JiraCreateForm: Component<JiraCreateFormProps> = (props) => {
  const projectKey = props.jiraProjectKey;

  const [issueTypes] = createResource(() =>
    listJiraIssueTypes({ projectKey }).then((r) => r.data),
  );
  const [priorities] = createResource(() =>
    listJiraPriorities().then((r) => r.data),
  );

  // Validate defaults exist in API response
  const validation = () => {
    const types = issueTypes();
    const prios = priorities();
    if (!types || !prios) return null; // still loading

    const errors: string[] = [];
    if (!types.find((t) => t.name === DEFAULT_ISSUE_TYPE))
      errors.push(`Issue type "${DEFAULT_ISSUE_TYPE}" not found in ${projectKey}`);
    if (!prios.find((p) => p.name === DEFAULT_PRIORITY))
      errors.push(`Priority "${DEFAULT_PRIORITY}" not found in JIRA`);

    return errors.length > 0 ? { ok: false as const, errors } : { ok: true as const };
  };

  return (
    <Switch>
      <Match when={issueTypes.loading || priorities.loading}>
        <div class="text-white/40 text-[12px]">Loading JIRA data…</div>
      </Match>
      <Match when={validation()?.ok === false}>
        <div class="p-3 bg-red-500/20 border border-red-500/30 rounded text-[11px] text-red-300">
          <p class="font-semibold mb-1">Configuration error</p>
          <For each={(validation() as { ok: false; errors: string[] }).errors}>
            {(err) => <p>{err}</p>}
          </For>
        </div>
      </Match>
      <Match when={validation()?.ok}>
        <JiraCreateFormReady
          {...props}
          issueTypes={issueTypes()!}
          priorities={priorities()!}
        />
      </Match>
    </Switch>
  );
};
```

**`JiraCreateFormReady`** receives validated data as props — no loading states, no effects, no uncertainty:

```typescript
interface JiraCreateFormReadyProps extends JiraCreateFormProps {
  issueTypes: Array<{ id: string; name: string }>;
  priorities: Array<{ id: string; name: string }>;
}

const JiraCreateFormReady: Component<JiraCreateFormReadyProps> = (props) => {
  const projectKey = props.jiraProjectKey;
  const [issueType, setIssueType] = createSignal(DEFAULT_ISSUE_TYPE);
  const [priority, setPriority] = createSignal(DEFAULT_PRIORITY);
  const [summary, setSummary] = createSignal(defaultSummary(props.group));
  const [description, setDescription] = createSignal(
    defaultDescription(props.group, props.commentItems),
  );
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // ... screenshotList, handleSubmit (uses projectKey constant), JSX
};
```

Signals initialize with validated defaults. No `createEffect`, no conditional checks — the loader already proved these values exist.

### 6. Simplified JSX in `JiraCreateFormReady`

**File:** `packages/react-grab/src/components/sidebar/jira-create-form.tsx`

The project selector block (lines 106-124) is **deleted entirely**.

Issue type and priority selectors iterate over `props.issueTypes` / `props.priorities` (arrays, not resources):

```tsx
{/* Issue type — pre-selected to "Task" */}
<div class="mb-3">
  <label class="block text-[11px] text-white/50 mb-1">Work Type *</label>
  <select
    class="w-full bg-white/10 text-white text-[12px] rounded px-2 py-1.5 border border-white/10"
    style={{ "pointer-events": "auto" }}
    value={issueType()}
    onChange={(e) => setIssueType(e.currentTarget.value)}
    required
  >
    <For each={props.issueTypes}>
      {(t) => <option value={t.name}>{t.name}</option>}
    </For>
  </select>
</div>

{/* Priority — pre-selected to "Medium" */}
<div class="mb-3">
  <label class="block text-[11px] text-white/50 mb-1">Priority</label>
  <select
    class="w-full bg-white/10 text-white text-[12px] rounded px-2 py-1.5 border border-white/10"
    style={{ "pointer-events": "auto" }}
    value={priority()}
    onChange={(e) => setPriority(e.currentTarget.value)}
  >
    <For each={props.priorities}>
      {(p) => <option value={p.name}>{p.name}</option>}
    </For>
  </select>
</div>
```

No `<Suspense>`, no `disabled`, no conditional placeholders. The `<Switch>` in the loader handles all async states.

Submit button simplified:

```tsx
disabled={submitting() || !issueType()}
```

Submission body uses the constant:

```typescript
projectKey,  // from props.jiraProjectKey — not a signal
```

### 7. Validate `jiraProjectKey` at init

**File:** `packages/react-grab/src/core/index.tsx` — inside `initSync` (line 223)

```typescript
export const initSync = async (config: SyncConfig): Promise<void> => {
  if (!config.jiraProjectKey) {
    throw new Error("react-grab: SyncConfig.jiraProjectKey is required (e.g. 'ATT')");
  }
  // ... existing logic
```

This throws early and loud — no silent fallback.

### 8. Sync-server cleanup (optional, deferred)

The `getProjects` method in `jira.service.ts` (line 137) and the `/jira/projects` route in `jira.ts` (line 58) become unused by the sidebar. They can be kept for other consumers or removed in a follow-up. No sync-server changes are required for this SPEC.

## Testing Strategy

### Unit Tests

- `JiraCreateForm` renders without a project `<select>` element
- `JiraCreateForm` loads issue types immediately on mount (no waiting for project selection)
- `JiraCreateForm` submit sends `projectKey` from props, not from a signal
- `JiraCreateForm` submit button is disabled only when `issueType` is empty (not when project is empty)

### Integration Tests

- Dialog opens → issue types load immediately → user can select type and submit without choosing project
- `createJiraTicket` is called with `projectKey: "ATT"` (from config)

### Validation

- `initSync({ ..., jiraProjectKey: "" })` throws an error
- `initSync({ ..., jiraProjectKey: "ATT" })` succeeds
- TypeScript compile fails if `jiraProjectKey` is omitted from `SyncConfig`

## Acceptance Criteria

### Config
- [x] `SyncConfig.jiraProjectKey: string` added (required field)
- [x] `initSync` throws if `jiraProjectKey` is falsy
- [x] `syncState` carries `jiraProjectKey`
- [x] TypeScript compile error when `jiraProjectKey` omitted from `SyncConfig`

### Prop Threading
- [x] `SidebarProps.jiraProjectKey` added
- [x] `core/index.tsx` passes `syncState.jiraProjectKey` to `<Sidebar>` (via ReactGrabRenderer)
- [x] Sidebar passes `jiraProjectKey` to `GroupDetailView`
- [x] `GroupDetailView` passes `jiraProjectKey` to `JiraCreateForm` (via JiraCreateDialog)
- [x] `JiraCreateFormProps.jiraProjectKey: string` added (required)

### Architecture: Loading → Validate → Form (or Error)
- [x] `JiraCreateForm` split into loader + `JiraCreateFormReady`
- [x] Loader fetches issue types and priorities via `createResource`
- [x] Loader shows loading state while resources pending
- [x] Loader validates `"Task"` exists in issue types response — shows config error if missing
- [x] Loader validates `"Medium"` exists in priorities response — shows config error if missing
- [x] `JiraCreateFormReady` receives validated `issueTypes` and `priorities` as plain array props
- [x] `issueType` signal initializes to `"Task"` (guaranteed by loader)
- [x] `priority` signal initializes to `"Medium"` (guaranteed by loader)
- [x] No `createEffect` for default selection — loader handles validation

### Form Changes
- [x] `listJiraProjects` import removed from `jira-create-form.tsx`
- [x] `projects` resource removed
- [x] `projectKey` is a constant from `props.jiraProjectKey` (not a signal)
- [x] Project `<select>` block removed from JSX
- [x] `<Suspense>` removed — loader's `<Switch>` handles async states
- [x] Issue type and priority selectors iterate plain arrays (not resources)
- [x] No `disabled` state or "Select a project first…" placeholder
- [x] Submit button disabled check: `submitting() || !issueType()` only
- [x] Submit body uses `props.jiraProjectKey` directly

### Verification
- [x] Dialog opens and issue types appear immediately (no project selection step)
- [ ] Ticket created successfully with hardcoded project key
- [x] `decree lint` passes

### Deferred
- [ ] Remove `/jira/projects` sync-server route and `getProjects` service method
- [ ] Remove `listJiraProjects` from Orval-generated client (requires OpenAPI spec change + codegen)
