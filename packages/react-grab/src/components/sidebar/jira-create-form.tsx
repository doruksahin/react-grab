// packages/react-grab/src/components/sidebar/jira-create-form.tsx
import {
  type Component,
  createResource,
  createSignal,
  For,
  Match,
  Show,
  Switch,
} from "solid-js";
import {
  listJiraIssueTypes,
  listJiraPriorities,
  createJiraTicket,
} from "../../generated/sync-api.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import type { CommentItem } from "../../types.js";
import { defaultSummary, defaultDescription } from "../../features/sidebar/jira-defaults.js";

const DEFAULT_ISSUE_TYPE = "Task";
const DEFAULT_PRIORITY = "Medium";

interface JiraCreateFormProps {
  /** Workspace ID — the `id` param in Orval-generated createJiraTicket(id, groupId, body) */
  workspaceId: string;
  groupId: string;
  group: SelectionGroupWithJira;
  commentItems: CommentItem[];
  jiraProjectKey: string;
  onSuccess: (groupId: string, ticketId: string, ticketUrl: string) => void;
  onClose: () => void;
}

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

  const screenshotList = () =>
    props.commentItems.flatMap((item) => {
      const names: string[] = [];
      if (item.screenshotElement) names.push(`${item.id}-element.png`);
      if (item.screenshotFullPage) names.push(`${item.id}-full.png`);
      return names;
    });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!issueType()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createJiraTicket(
        props.workspaceId,
        props.groupId,
        {
          projectKey,
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
          disabled={submitting() || !issueType()}
          class="px-3 py-1.5 text-[12px] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
          style={{ "pointer-events": "auto" }}
        >
          {submitting() ? "Creating…" : "Create Ticket"}
        </button>
      </div>
    </form>
  );
};

export const JiraCreateForm: Component<JiraCreateFormProps> = (props) => {
  const projectKey = props.jiraProjectKey;

  const [issueTypes] = createResource(() =>
    listJiraIssueTypes({ projectKey }).then((r) => {
      if (r.status !== 200) throw new Error("Failed to load issue types");
      return r.data;
    }),
  );
  const [priorities] = createResource(() =>
    listJiraPriorities().then((r) => {
      if (r.status !== 200) throw new Error("Failed to load priorities");
      return r.data;
    }),
  );

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
