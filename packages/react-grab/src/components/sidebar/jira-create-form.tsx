import { type Component, type JSX, createSignal, For, Show } from "solid-js";
import { Alert } from "../ui/alert.js";
import { Button } from "../ui/button.js";
import { Textarea } from "../ui/textarea.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs.js";
import { IconAlertCircle } from "../icons/icon-alert-circle.js";
import { IconCheck } from "../icons/icon-check.js";
import { DialogLayout, DialogHeader } from "./dialog-layout.js";
import { MarkdownPreview } from "./markdown-preview.js";
import { ScreenshotPair } from "./screenshot-pair.js";
import { screenshotRefs } from "../../features/screenshot/index.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select.js";
import { LabelSelect } from "./label-select.js";
import type { SelectionGroup } from "../../features/selection-groups/types.js";
import type { CommentItem, TicketCreatedCallback } from "../../types.js";
import {
  defaultSummary,
  normalizeSummary,
} from "../../features/jira-ticket/business/default-summary.js";
import { describeCreateFailure } from "../../features/jira-ticket/business/describe-create-failure.js";
import {
  useJiraTicketCreation,
  type JiraTicketCreation,
} from "../../features/jira-ticket/hooks/use-jira-ticket-creation.js";
import { useJiraDestination } from "../../features/jira-ticket/hooks/use-jira-destination.js";
import { describeDestinationProblem } from "../../features/jira-ticket/business/describe-destination-problem.js";
import { getSiteHost } from "../../features/jira-ticket/business/site-host.js";
import type { JiraDestination } from "../../features/sync/types.js";

const DEFAULT_ISSUE_TYPE = "Task";
const DEFAULT_PRIORITY = "Medium";

interface JiraCreateFormProps {
  groupId: string;
  group: SelectionGroup;
  commentItems: CommentItem[];
  onSuccess: TicketCreatedCallback;
  onClose: () => void;
}

const noScrollRoot = () => null;

const TRIGGER_CLASS = "bg-muted text-body text-foreground";

const selectionCountText = (count: number) =>
  `${count} ${count === 1 ? "selection" : "selections"}`;

/** "Into SCRUM on acme.atlassian.net, as Ada · 2 selections" (ADR-0027). */
const DestinationLine: Component<{
  destination: JiraDestination;
  selectionCount: number;
}> = (props) => (
  <span data-react-grab-jira-destination>
    Into{" "}
    <strong class="font-semibold text-foreground">
      {props.destination.projectKey}
    </strong>
    <Show when={getSiteHost(props.destination.siteUrl)}>
      {(host) => <> on {host()}</>}
    </Show>
    , as{" "}
    <span data-react-grab-jira-signs-in-as>
      {props.destination.signsInAs}
    </span>
    {` · ${selectionCountText(props.selectionCount)}`}
  </span>
);

/**
 * The dialog while the destination loads or cannot be used: the reason, a
 * pointer to the settings, and a Create button that stays disabled.
 */
const DestinationGate: Component<{
  title: string;
  onClose: () => void;
  children: JSX.Element;
}> = (props) => (
  <DialogLayout
    header={
      <DialogHeader
        title="Create Jira ticket"
        subtitle={props.title}
        onClose={props.onClose}
      />
    }
    footer={
      <div class="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          style={{ "pointer-events": "auto" }}
          onClick={props.onClose}
        >
          Cancel
        </Button>
        <Button type="button" variant="inverse" size="sm" disabled>
          Create ticket
        </Button>
      </div>
    }
  >
    {props.children}
  </DialogLayout>
);

export const JiraCreateForm: Component<JiraCreateFormProps> = (props) => {
  const destination = useJiraDestination();
  const problem = () =>
    destination.state === "errored"
      ? describeDestinationProblem(destination.error)
      : null;

  return (
    <Show
      when={destination.state === "ready" ? destination() : undefined}
      keyed
      fallback={
        <Show
          when={problem()}
          fallback={
            <DestinationGate
              title="Loading the Jira destination…"
              onClose={props.onClose}
            >
              <LoadingField />
            </DestinationGate>
          }
        >
          {(reason) => (
            <DestinationGate
              title="Cannot create a ticket"
              onClose={props.onClose}
            >
              <Alert
                data-react-grab-jira-destination-problem
                data-code={reason().code ?? undefined}
              >
                <IconAlertCircle class="mt-0.5 shrink-0" />
                <div class="flex flex-col gap-1">
                  <p class="font-semibold">{reason().title}</p>
                  <p class="text-caption">{reason().detail}</p>
                </div>
              </Alert>
            </DestinationGate>
          )}
        </Show>
      }
    >
      {(ready) => (
        <JiraCreateFormForDestination {...props} destination={ready} />
      )}
    </Show>
  );
};

interface JiraCreateFormForDestinationProps extends JiraCreateFormProps {
  destination: JiraDestination;
}

const JiraCreateFormForDestination: Component<
  JiraCreateFormForDestinationProps
> = (props) => {
  const creation = useJiraTicketCreation();

  const configError = () => {
    const types = creation.issueTypes();
    const prios = creation.priorities();
    if (!types || !prios) return null;
    const errors: string[] = [];
    if (!types.find((t) => t.name === DEFAULT_ISSUE_TYPE))
      errors.push(
        `Issue type "${DEFAULT_ISSUE_TYPE}" not found in ${props.destination.projectKey}`,
      );
    if (!prios.find((p) => p.name === DEFAULT_PRIORITY))
      errors.push(`Priority "${DEFAULT_PRIORITY}" not found in JIRA`);
    return errors.length > 0 ? errors : null;
  };

  return (
    <Show
      when={!configError()}
      fallback={
        <Alert class="m-4">
          <IconAlertCircle class="mt-0.5 shrink-0" />
          <div class="flex flex-col gap-1">
            <p class="font-semibold">Configuration error</p>
            <For each={configError()!}>
              {(err) => <p class="text-caption">{err}</p>}
            </For>
          </div>
        </Alert>
      }
    >
      <JiraCreateFormInner {...props} creation={creation} />
    </Show>
  );
};

interface CreatedTicket {
  ticketId: string;
  url: string;
}

interface JiraCreateFormInnerProps extends JiraCreateFormForDestinationProps {
  creation: JiraTicketCreation;
}

const FieldLabel: Component<{ children: JSX.Element }> = (props) => (
  <span class="flex justify-between text-caption font-medium text-muted-foreground">
    {props.children}
  </span>
);

const RequiredMark: Component = () => (
  <span data-react-grab-jira-required class="text-danger-light">
    Required
  </span>
);

const LoadingField: Component = () => (
  <div class="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-body italic text-muted-foreground">
    Loading…
  </div>
);

const JiraCreateFormInner: Component<JiraCreateFormInnerProps> = (props) => {
  const [issueType, setIssueType] = createSignal(DEFAULT_ISSUE_TYPE);
  const [priority, setPriority] = createSignal(DEFAULT_PRIORITY);
  const [summary, setSummary] = createSignal(
    defaultSummary(props.group, props.commentItems),
  );
  const [note, setNote] = createSignal("");
  const [noteView, setNoteView] = createSignal("edit");
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
    Boolean(props.creation.issueTypes()) &&
    Boolean(props.creation.priorities());

  const submitLabel = () => {
    if (submitting()) return "Creating…";
    return failure() === null ? "Create ticket" : "Retry";
  };

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!canSubmit()) return;
    setSubmitting(true);
    setFailure(null);
    try {
      const ticket = await props.creation.createTicket(props.groupId, {
        issueType: issueType(),
        priority: priority(),
        summary: normalizeSummary(summary()),
        note: note(),
        labels: selectedLabels().length > 0 ? selectedLabels() : undefined,
      });
      setCreated({ ticketId: ticket.jiraTicketId, url: ticket.jiraUrl });
      props.onSuccess(props.groupId, ticket.jiraTicketId, ticket.jiraUrl);
    } catch (error) {
      setFailure(describeCreateFailure(error));
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
                : "Create Jira ticket"
            }
            subtitle={
              <DestinationLine
                destination={props.destination}
                selectionCount={props.commentItems.length}
              />
            }
            onClose={props.onClose}
          />
        }
        footer={
          <div
            class="flex items-center justify-end gap-2"
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
                    variant="inverse"
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
                    class="px-2 text-body text-jira-create hover:underline"
                    style={{ "pointer-events": "auto" }}
                  >
                    Open in Jira ↗
                  </a>
                  <Button
                    type="button"
                    variant="inverse"
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
          <Alert data-react-grab-jira-error>
            <IconAlertCircle class="mt-0.5 shrink-0" />
            <div class="flex flex-col gap-1">
              <p>Could not create the ticket. Your form is kept.</p>
              <Show when={failure()}>
                <p class="text-caption text-muted-foreground">{failure()}</p>
              </Show>
            </div>
          </Alert>
        </Show>
        <Show when={created()}>
          {(ticket) => (
            <Alert data-react-grab-jira-success tone="success">
              <IconCheck class="mt-0.5 shrink-0" />
              <p>
                The ticket is in Jira. This group is now locked to{" "}
                {ticket().ticketId}.
              </p>
            </Alert>
          )}
        </Show>

        {/* Summary — first, starting from the comment (defaultSummary) */}
        <label class="flex flex-col gap-1.5">
          <FieldLabel>
            <span>Summary</span>
            <Show when={summaryMissing()}>
              <RequiredMark />
            </Show>
          </FieldLabel>
          <Textarea
            variant="field"
            class="min-h-9 py-2"
            style={{ "pointer-events": "auto" }}
            rows={1}
            value={summary()}
            onInput={(e) => setSummary(e.currentTarget.value)}
            readOnly={Boolean(created())}
            placeholder="Add a short summary"
          />
        </label>

        <div class="grid grid-cols-3 gap-3">
          {/* Work type — pre-selected to "Task" */}
          <div class="flex min-w-0 flex-col gap-1.5">
            <FieldLabel>
              <span>Work type</span>
              <Show when={workTypeMissing()}>
                <RequiredMark />
              </Show>
            </FieldLabel>
            <Show
              when={props.creation.issueTypes()}
              fallback={<LoadingField />}
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
                    aria-label="Work type"
                    class={TRIGGER_CLASS}
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
          <div class="flex min-w-0 flex-col gap-1.5">
            <FieldLabel>Priority</FieldLabel>
            <Show
              when={props.creation.priorities()}
              fallback={<LoadingField />}
            >
              {(prios) => (
                <Select
                  defaultValue={DEFAULT_PRIORITY}
                  onChange={(value: string | null) =>
                    value && setPriority(value)
                  }
                  options={prios().map((p) => p.name)}
                  itemComponent={(itemProps) => (
                    <SelectItem item={itemProps.item}>
                      {itemProps.item.rawValue}
                    </SelectItem>
                  )}
                >
                  <SelectTrigger
                    aria-label="Priority"
                    class={TRIGGER_CLASS}
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
          <div class="flex min-w-0 flex-col gap-1.5">
            <FieldLabel>Labels</FieldLabel>
            <Show
              when={props.creation.labels() !== undefined}
              fallback={<LoadingField />}
            >
              <LabelSelect
                allLabels={props.creation.labels() ?? []}
                value={selectedLabels()}
                onChange={setSelectedLabels}
              />
            </Show>
          </div>
        </div>

        {/* Note — the reporter's own text; the server adds the selections (ADR-0029) */}
        <Tabs value={noteView()} onChange={setNoteView} class="gap-1.5">
          <div class="flex items-center gap-2">
            <span class="flex-1 text-caption font-medium text-muted-foreground">
              Note (optional)
            </span>
            <TabsList aria-label="Note view" class="w-36">
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="edit">
            <Textarea
              data-react-grab-jira-note-input
              variant="field"
              aria-label="Note"
              placeholder="Anything the selections do not say"
              class="max-h-64 font-mono text-caption"
              style={{ "pointer-events": "auto" }}
              rows={4}
              value={note()}
              onInput={(e) => setNote(e.currentTarget.value)}
              readOnly={Boolean(created())}
            />
          </TabsContent>
          <TabsContent value="preview">
            <MarkdownPreview
              data-react-grab-jira-note-preview
              markdown={note()}
              class="max-h-64 overflow-y-auto rounded-lg border border-border bg-muted/60 px-3.5 py-3"
            />
          </TabsContent>
          <p
            data-react-grab-jira-note-hint
            class="text-caption text-muted-foreground"
          >
            The ticket also gets each selection's comment, steps, recording and
            page.
          </p>
        </Tabs>

        {/* Attachments — screenshot previews */}
        <div class="flex flex-col gap-1.5">
          <FieldLabel>Screenshots</FieldLabel>
          <Show
            when={itemsWithScreenshots().length > 0}
            fallback={
              <p class="text-caption italic text-muted-foreground">
                No screenshots
              </p>
            }
          >
            <For each={itemsWithScreenshots()}>
              {(item) => (
                <ScreenshotPair
                  element={screenshotRefs(item).element}
                  fullPage={screenshotRefs(item).fullPage}
                  scrollRoot={noScrollRoot}
                />
              )}
            </For>
            <p class="text-caption text-muted-foreground">
              These attach to the ticket.
            </p>
          </Show>
        </div>
      </DialogLayout>
    </form>
  );
};
