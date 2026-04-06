// packages/react-grab/src/components/sidebar/jira-create-form.tsx
import {
  type Component,
  createResource,
  createSignal,
  For,
  Show,
  Suspense,
} from "solid-js";
import {
  listJiraProjects,
  listJiraIssueTypes,
  listJiraPriorities,
  createJiraTicket,
} from "../../generated/sync-api.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import type { CommentItem } from "../../types.js";
import { defaultSummary, defaultDescription } from "../../features/sidebar/jira-defaults.js";

interface JiraCreateFormProps {
  /** Workspace ID — the `id` param in Orval-generated createJiraTicket(id, groupId, body) */
  workspaceId: string;
  groupId: string;
  group: SelectionGroupWithJira;
  commentItems: CommentItem[];
  onSuccess: (groupId: string, ticketId: string, ticketUrl: string) => void;
  onClose: () => void;
}

export const JiraCreateForm: Component<JiraCreateFormProps> = (props) => {
  const [projectKey, setProjectKey] = createSignal("");
  const [issueType, setIssueType] = createSignal("");
  const [priority, setPriority] = createSignal("Medium");
  const [summary, setSummary] = createSignal(defaultSummary(props.group));
  const [description, setDescription] = createSignal(
    defaultDescription(props.group, props.commentItems),
  );
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Load projects and priorities on mount
  const [projects] = createResource(() =>
    listJiraProjects().then((r) => r.data),
  );
  const [priorities] = createResource(() =>
    listJiraPriorities().then((r) => r.data),
  );

  // Load issue types only when a project is selected
  const [issueTypes] = createResource(
    () => projectKey() || undefined,
    (key) => listJiraIssueTypes({ projectKey: key }).then((r) => r.data),
  );

  // Screenshot filenames for the informational attachments section
  const screenshotList = () =>
    props.commentItems.flatMap((item) => {
      const names: string[] = [];
      if (item.screenshotElement) names.push(`${item.id}-element.png`);
      if (item.screenshotFullPage) names.push(`${item.id}-full.png`);
      return names;
    });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!projectKey() || !issueType()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createJiraTicket(
        props.workspaceId,
        props.groupId,
        {
          projectKey: projectKey(),
          issueType: issueType(),
          priority: priority(),
          summary: summary(),
          description: description(),
        },
      );
      if (result.status === 200) {
        props.onSuccess(
          props.groupId,
          result.data.jiraTicketId,
          result.data.jiraUrl,
        );
        props.onClose();
      } else {
        const errData = result.data as { error?: string };
        setError(errData.error ?? "Failed to create ticket");
      }
    } catch {
      setError("Network error — check your connection and try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form data-react-grab-jira-form onSubmit={handleSubmit} style={{ "pointer-events": "auto" }}>
      <h2 class="text-[16px] font-semibold text-white mb-4">
        Create JIRA Ticket
      </h2>

      <Suspense fallback={<div class="text-white/40 text-[12px]">Loading JIRA data…</div>}>
        {/* Project selector — native <select> for Phase 3; Kobalte Combobox in Phase 4 */}
        <div class="mb-3">
          <label class="block text-[11px] text-white/50 mb-1">Project *</label>
          <select
            class="w-full bg-white/10 text-white text-[12px] rounded px-2 py-1.5 border border-white/10"
            style={{ "pointer-events": "auto" }}
            value={projectKey()}
            onChange={(e) => {
              setProjectKey(e.currentTarget.value);
              setIssueType(""); // reset issue type when project changes
            }}
            required
          >
            <option value="">Select project…</option>
            <For each={projects()}>
              {(p) => <option value={p.key}>{p.name} ({p.key})</option>}
            </For>
          </select>
        </div>

        {/* Issue type selector — disabled until project is selected */}
        <div class="mb-3">
          <label class="block text-[11px] text-white/50 mb-1">Work Type *</label>
          <select
            class="w-full bg-white/10 text-white text-[12px] rounded px-2 py-1.5 border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ "pointer-events": "auto" }}
            value={issueType()}
            onChange={(e) => setIssueType(e.currentTarget.value)}
            disabled={!projectKey()}
            required
          >
            <option value="">{!projectKey() ? "Select a project first…" : issueTypes.loading ? "Loading…" : "Select type…"}</option>
            <For each={issueTypes()}>
              {(t) => <option value={t.name}>{t.name}</option>}
            </For>
          </select>
        </div>

        {/* Priority selector */}
        <div class="mb-3">
          <label class="block text-[11px] text-white/50 mb-1">Priority</label>
          <select
            class="w-full bg-white/10 text-white text-[12px] rounded px-2 py-1.5 border border-white/10"
            style={{ "pointer-events": "auto" }}
            value={priority()}
            onChange={(e) => setPriority(e.currentTarget.value)}
          >
            <For each={priorities()}>
              {(p) => <option value={p.name}>{p.name}</option>}
            </For>
          </select>
        </div>
      </Suspense>

      {/* Summary */}
      <div class="mb-3">
        <label class="block text-[11px] text-white/50 mb-1">Summary *</label>
        <textarea
          class="w-full bg-white/10 text-white text-[12px] rounded px-2 py-1.5 border border-white/10 resize-none"
          style={{ "pointer-events": "auto" }}
          rows={2}
          value={summary()}
          onInput={(e) => setSummary(e.currentTarget.value)}
          required
        />
      </div>

      {/* Description */}
      <div class="mb-3">
        <label class="block text-[11px] text-white/50 mb-1">
          Description{" "}
          <span class="text-white/30">(markdown — converted to ADF on submit)</span>
        </label>
        <textarea
          class="w-full bg-white/10 text-white text-[12px] rounded px-2 py-1.5 border border-white/10 font-mono resize-none"
          style={{ "pointer-events": "auto" }}
          rows={6}
          value={description()}
          onInput={(e) => setDescription(e.currentTarget.value)}
        />
      </div>

      {/* Attachments (informational only — server attaches screenshots) */}
      <div class="mb-4">
        <p class="text-[11px] text-white/50 mb-1">Attachments</p>
        <Show
          when={screenshotList().length > 0}
          fallback={
            <p class="text-[10px] text-white/30 italic">No screenshots</p>
          }
        >
          <For each={screenshotList()}>
            {(name) => (
              <div class="text-[10px] text-white/40 font-mono">{name}</div>
            )}
          </For>
        </Show>
      </div>

      {/* Error */}
      <Show when={error()}>
        <div class="mb-3 p-2 bg-red-500/20 border border-red-500/30 rounded text-[11px] text-red-300">
          {error()}
        </div>
      </Show>

      {/* Actions */}
      <div class="flex gap-2 justify-end" style={{ "pointer-events": "auto" }}>
        <button
          type="button"
          class="px-3 py-1.5 text-[12px] text-white/60 hover:text-white rounded hover:bg-white/10 transition-colors"
          style={{ "pointer-events": "auto" }}
          onClick={props.onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting() || !projectKey() || !issueType()}
          class="px-3 py-1.5 text-[12px] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
          style={{ "pointer-events": "auto" }}
        >
          {submitting() ? "Creating…" : "Create Ticket"}
        </button>
      </div>
    </form>
  );
};
