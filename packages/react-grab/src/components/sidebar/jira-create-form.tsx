// packages/react-grab/src/components/sidebar/jira-create-form.tsx
// packages/react-grab/src/components/sidebar/jira-create-form.tsx
import {
  type Component,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { Button } from "../ui/button.js";
import { DialogLayout, DialogHeader } from "./dialog-layout.js";
import { JiraEditor } from "./jira-editor.js";
import { ScreenshotPair } from "./screenshot-pair.js";
import { screenshotUrl } from "../../features/sidebar/screenshot-url.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select.js";
import { LabelSelect } from "./label-select.js";
import {
  listJiraIssueTypes,
  listJiraPriorities,
  listJiraLabels,
  createJiraTicket,
} from "../../generated/sync-api.js";
import type { SelectionGroup } from "../../features/selection-groups/types.js";
import type { CommentItem, TicketCreatedCallback } from "../../types.js";
import {
  defaultSummary,
  defaultDescription,
} from "../../features/sidebar/jira-defaults.js";

const DEFAULT_ISSUE_TYPE = "Task";
const DEFAULT_PRIORITY = "Medium";

interface JiraCreateFormProps {
  /** Workspace ID — the `id` param in Orval-generated createJiraTicket(id, groupId, body) */
  workspaceId: string;
  syncServerUrl?: string;
  groupId: string;
  group: SelectionGroup;
  commentItems: CommentItem[];
  jiraProjectKey: string;
  onSuccess: TicketCreatedCallback;
  onClose: () => void;
}

const noScrollRoot = () => null;

const triggerClass =
  "w-full text-[12px] bg-muted border-border text-foreground";
const textareaClass =
  "w-full bg-muted text-foreground text-[12px] rounded px-2 py-1.5 border border-border resize-none";

export const JiraCreateForm: Component<JiraCreateFormProps> = (props) => {
  const [issueTypes] = createResource(() =>
    listJiraIssueTypes({ projectKey: props.jiraProjectKey }).then((r) => {
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
  const [labels] = createResource(() =>
    listJiraLabels({ projectKey: props.jiraProjectKey }).then((r) => {
      if (r.status !== 200) return [] as string[];
      return r.data;
    }),
  );

  const configError = () => {
    const types = issueTypes();
    const prios = priorities();
    if (!types || !prios) return null;
    const errors: string[] = [];
    if (!types.find((t) => t.name === DEFAULT_ISSUE_TYPE))
      errors.push(
        `Issue type "${DEFAULT_ISSUE_TYPE}" not found in ${props.jiraProjectKey}`,
      );
    if (!prios.find((p) => p.name === DEFAULT_PRIORITY))
      errors.push(`Priority "${DEFAULT_PRIORITY}" not found in JIRA`);
    return errors.length > 0 ? errors : null;
  };

  return (
    <Show
      when={!configError()}
      fallback={
        <div class="p-3 bg-red-500/20 border border-red-500/30 rounded text-[11px] text-red-300">
          <p class="font-semibold mb-1">Configuration error</p>
          <For each={configError()!}>{(err) => <p>{err}</p>}</For>
        </div>
      }
    >
      <JiraCreateFormInner
        {...props}
        issueTypes={issueTypes}
        priorities={priorities}
        labels={labels}
      />
    </Show>
  );
};

interface CreatedTicket {
  ticketId: string;
  url: string;
}

interface JiraCreateFormInnerProps extends JiraCreateFormProps {
  issueTypes: () => Array<{ id: string; name: string }> | undefined;
  priorities: () => Array<{ id: string; name: string }> | undefined;
  labels: () => string[] | undefined;
}

const JiraCreateFormInner: Component<JiraCreateFormInnerProps> = (props) => {
  const projectKey = props.jiraProjectKey;
  const [issueType, setIssueType] = createSignal(DEFAULT_ISSUE_TYPE);
  const [priority, setPriority] = createSignal(DEFAULT_PRIORITY);
  const [summary, setSummary] = createSignal(defaultSummary(props.group));
  const [description, setDescription] = createSignal(
    defaultDescription(props.group, props.commentItems),
  );
  const [selectedLabels, setSelectedLabels] = createSignal<string[]>([]);
  const [submitting, setSubmitting] = createSignal(false);
  /** Detail of the last failed submit, or null when the last submit did not fail. */
  const [failure, setFailure] = createSignal<string | null>(null);
  const [created, setCreated] = createSignal<CreatedTicket | null>(null);

  const itemsWithScreenshots = () =>
    props.commentItems.filter(
      (item) => item.screenshotElement || item.screenshotFullPage,
    );

  const summaryMissing = () => summary().trim().length === 0;
  const workTypeMissing = () => !issueType();
  const canSubmit = () =>
    !submitting() &&
    !created() &&
    !summaryMissing() &&
    !workTypeMissing() &&
    Boolean(props.issueTypes()) &&
    Boolean(props.priorities());

  const submitLabel = () => {
    if (submitting()) return "Creating…";
    return failure() === null ? "Create Ticket" : "Retry";
  };

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!canSubmit()) return;
    setSubmitting(true);
    setFailure(null);
    try {
      const result = await createJiraTicket(props.workspaceId, props.groupId, {
        projectKey,
        issueType: issueType(),
        priority: priority(),
        summary: summary().trim(),
        description: description(),
        labels: selectedLabels().length > 0 ? selectedLabels() : undefined,
      });
      if (result.status === 200) {
        setCreated({
          ticketId: result.data.jiraTicketId,
          url: result.data.jiraUrl,
        });
        props.onSuccess(
          props.groupId,
          result.data.jiraTicketId,
          result.data.jiraUrl,
        );
      } else {
        const errData = result.data as { error?: string };
        setFailure(errData.error ?? "");
      }
    } catch {
      setFailure("Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      data-react-grab-jira-form
      onSubmit={handleSubmit}
      style={{ "pointer-events": "auto" }}
    >
      <DialogLayout
        header={
          <DialogHeader
            title={
              created()
                ? `✓ ${created()!.ticketId} created`
                : "Create JIRA Ticket"
            }
            onClose={props.onClose}
          />
        }
        footer={
          <div
            class="flex gap-2 justify-end items-center"
            style={{ "pointer-events": "auto" }}
          >
            <Show
              when={created()}
              fallback={
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    style={{ "pointer-events": "auto" }}
                    onClick={props.onClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!canSubmit()}
                    style={{ "pointer-events": "auto" }}
                  >
                    {submitLabel()}
                  </Button>
                </>
              }
            >
              {(ticket) => (
                <>
                  <a
                    data-react-grab-jira-open-ticket
                    href={ticket().url}
                    target="_blank"
                    rel="noreferrer noopener"
                    class="text-[12px] text-jira-create hover:underline px-2"
                    style={{ "pointer-events": "auto" }}
                  >
                    Open in Jira ↗
                  </a>
                  <Button
                    type="button"
                    size="sm"
                    style={{ "pointer-events": "auto" }}
                    onClick={props.onClose}
                  >
                    Done
                  </Button>
                </>
              )}
            </Show>
          </div>
        }
      >
        {/* Outcome of the last submit — kept above the fields so it is seen. */}
        <Show when={failure() !== null && !created()}>
          <div
            data-react-grab-jira-error
            class="mb-3 p-2 bg-red-500/20 border border-red-500/30 rounded text-[11px] text-red-300"
          >
            <p>Could not create the ticket. Your form is kept.</p>
            <Show when={failure()}>
              <p class="mt-1 opacity-80">{failure()}</p>
            </Show>
          </div>
        </Show>
        <Show when={created()}>
          {(ticket) => (
            <div
              data-react-grab-jira-success
              class="mb-3 p-2 bg-green-500/15 border border-green-500/30 rounded text-[11px] text-green-300"
            >
              The ticket is in Jira. This group is now locked to{" "}
              {ticket().ticketId}.
            </div>
          )}
        </Show>

        {/* Issue type — pre-selected to "Task" */}
        <div class="mb-3">
          <label class="flex justify-between text-[11px] text-muted-foreground mb-1">
            <span>Work Type *</span>
            <Show when={workTypeMissing()}>
              <span data-react-grab-jira-required class="text-red-400">
                Required
              </span>
            </Show>
          </label>
          <Show
            when={props.issueTypes()}
            fallback={
              <div
                class={`${triggerClass} h-9 px-3 flex items-center rounded-md border text-muted-foreground italic`}
              >
                Loading…
              </div>
            }
          >
            {(types) => (
              <Select
                defaultValue={DEFAULT_ISSUE_TYPE}
                onChange={(value: string | null) =>
                  value && setIssueType(value)
                }
                options={types().map((t) => t.name)}
                itemComponent={(itemProps) => (
                  <SelectItem item={itemProps.item}>
                    {itemProps.item.rawValue}
                  </SelectItem>
                )}
              >
                <SelectTrigger
                  class={triggerClass}
                  style={{ "pointer-events": "auto" }}
                >
                  <SelectValue<string>>
                    {(state) => state.selectedOption()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
              </Select>
            )}
          </Show>
        </div>

        {/* Priority — pre-selected to "Medium" */}
        <div class="mb-3">
          <label class="block text-[11px] text-muted-foreground mb-1">
            Priority
          </label>
          <Show
            when={props.priorities()}
            fallback={
              <div
                class={`${triggerClass} h-9 px-3 flex items-center rounded-md border text-muted-foreground italic`}
              >
                Loading…
              </div>
            }
          >
            {(prios) => (
              <Select
                defaultValue={DEFAULT_PRIORITY}
                onChange={(value: string | null) => value && setPriority(value)}
                options={prios().map((p) => p.name)}
                itemComponent={(itemProps) => (
                  <SelectItem item={itemProps.item}>
                    {itemProps.item.rawValue}
                  </SelectItem>
                )}
              >
                <SelectTrigger
                  class={triggerClass}
                  style={{ "pointer-events": "auto" }}
                >
                  <SelectValue<string>>
                    {(state) => state.selectedOption()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
              </Select>
            )}
          </Show>
        </div>

        {/* Labels — optional multi-select with search */}
        <div class="mb-3">
          <label class="block text-[11px] text-muted-foreground mb-1">
            Labels
          </label>
          <Show
            when={props.labels() !== undefined}
            fallback={
              <div
                class={`${triggerClass} h-9 px-3 flex items-center rounded-md border text-muted-foreground italic`}
              >
                Loading…
              </div>
            }
          >
            <LabelSelect
              allLabels={props.labels() ?? []}
              value={selectedLabels()}
              onChange={setSelectedLabels}
            />
          </Show>
        </div>

        {/* Summary */}
        <div class="mb-3">
          <label class="flex justify-between text-[11px] text-muted-foreground mb-1">
            <span>Summary *</span>
            <Show when={summaryMissing()}>
              <span data-react-grab-jira-required class="text-red-400">
                Required
              </span>
            </Show>
          </label>
          <textarea
            class={textareaClass}
            style={{ "pointer-events": "auto" }}
            rows={2}
            value={summary()}
            onInput={(e) => setSummary(e.currentTarget.value)}
            readOnly={Boolean(created())}
            placeholder="Add a short summary"
          />
        </div>

        {/* Description */}
        <div class="mb-3">
          <label class="block text-[11px] text-muted-foreground mb-1">
            Description
          </label>
          <JiraEditor initialValue={description()} onChange={setDescription} />
        </div>

        {/* Attachments — screenshot previews */}
        <div class="mb-4">
          <p class="text-[11px] text-muted-foreground mb-1">Screenshots</p>
          <Show
            when={itemsWithScreenshots().length > 0}
            fallback={
              <p class="text-[10px] text-muted-foreground italic">
                No screenshots
              </p>
            }
          >
            <For each={itemsWithScreenshots()}>
              {(item) => (
                <ScreenshotPair
                  elementSrc={
                    item.screenshotElement && props.syncServerUrl
                      ? screenshotUrl(
                          props.syncServerUrl,
                          props.workspaceId,
                          item.id,
                          "element",
                        )
                      : undefined
                  }
                  fullPageSrc={
                    item.screenshotFullPage && props.syncServerUrl
                      ? screenshotUrl(
                          props.syncServerUrl,
                          props.workspaceId,
                          item.id,
                          "full",
                        )
                      : undefined
                  }
                  scrollRoot={noScrollRoot}
                />
              )}
            </For>
          </Show>
        </div>
      </DialogLayout>
    </form>
  );
};
