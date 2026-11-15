import { type Component, type JSX, For, Show } from "solid-js";
import type {
  JiraComment,
  SearchJiraUsersFn,
  SubmitCommentFn,
} from "../../features/jira-comments/types.js";
import { JiraTicketLink } from "../ui/jira-ticket-link.jsx";
import { PriorityIcon } from "./priority-icon.jsx";
import { Avatar } from "../ui/avatar.jsx";
import { CommentsSection } from "../jira-comments/comments-section.jsx";
import { relativeTime } from "../../features/sidebar/relative-time.js";
import { screenshotUrl } from "../../features/sidebar/screenshot-url.js";
import { ScreenshotThumb } from "./screenshot-thumb.js";
import { StatusChip } from "../ui/status-chip.jsx";
import { getStatusChip } from "../../features/sidebar/get-status-chip.js";
import { Badge } from "../ui/badge.jsx";

const formatDueDate = (dueDate: string): string =>
  new Date(dueDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

interface SelectionCardBodySlots {
  /** Optional element rendered before the summary text (e.g. a multi-select checkbox). */
  leading?: JSX.Element;
  /** Summary text element — pass undefined when omitted so the header is hidden. */
  summary?: JSX.Element;
  /** Element rendered between the header and the labels/status row (e.g. group picker). */
  subheader?: JSX.Element;
  statusPill?: JSX.Element;
  labels?: JSX.Element;
  dates?: JSX.Element;
  screenshots?: JSX.Element;
  meta?: JSX.Element;
  comments?: JSX.Element;
  /** Footer action rendered at the very bottom (e.g. Create Ticket button). */
  footer?: JSX.Element;
}

const SelectionCardBodyLayout: Component<SelectionCardBodySlots> = (props) => {
  const hasHeader = () =>
    props.leading !== undefined ||
    props.summary !== undefined ||
    props.subheader !== undefined;

  return (
    <div data-react-grab-selection-card-body class="w-full">
      <Show when={hasHeader()}>
        <div class="flex items-center gap-2">
          {props.leading}
          {props.summary}
          <span class="flex-1" />
          {props.subheader}
        </div>
        <hr class="border-border my-2" />
      </Show>
      <div class="flex items-center justify-between gap-2">
        <div class="flex flex-wrap gap-1.5">{props.labels}</div>
        {props.statusPill}
      </div>
      {props.dates}
      {props.screenshots}
      {props.meta}
      <Show when={props.comments || props.footer}>
        <hr class="border-border/40 mt-2.5 mb-1" />
      </Show>
      {props.comments}
      {props.footer}
    </div>
  );
};

export interface SelectionCardBodyProps {
  // Status pill (labels row, right-aligned)
  jiraTicketId?: string;
  jiraUrl?: string;
  jiraStatus?: string;
  jiraFlagged?: boolean;

  // Leading slot — optional element before the summary (e.g. multi-select checkbox)
  leading?: JSX.Element;

  // Summary row — omitted when not provided (e.g. inside the overlay label)
  summary?: string;

  // Subheader — rendered between header and labels row (e.g. group picker)
  subheader?: JSX.Element;

  // Labels row
  jiraLabels?: readonly string[];

  // Date row — omitted when timestamp is undefined (e.g. primary-selection
  // label that has a ticket but isn't persisted yet)
  timestamp?: number;
  jiraDueDate?: string | null;

  // Screenshot row (item-scoped) — requires itemId + sync config to render
  itemId?: string;
  hasElementScreenshot?: boolean;
  hasFullPageScreenshot?: boolean;
  syncServerUrl?: string;
  syncWorkspace?: string;

  // Link to the replay of how the user got here (SPEC-020)
  recordingUrl?: string;

  // Bottom meta row
  jiraIssueType?: string | null;
  jiraPriority?: string | null;
  jiraAssignee?: string | null;
  jiraAssigneeAvatar?: string | null;

  // Comments
  jiraComments?: ReadonlyArray<JiraComment>;
  onSubmitComment?: SubmitCommentFn;
  onSearchUsers?: SearchJiraUsersFn;
  onRefreshStatus?: () => void;
  commentEditorToolbarVisible?: boolean;

  // Screenshot click — when provided, thumbnails open in a lightbox. The
  // sidebar wires this via useImageLightbox; the floating selection label
  // omits it so thumbnails remain inert.
  onScreenshotClick?: (src: string, label: string) => void;

  // Slot rendered in the status pill area when no ticket exists.
  // When undefined, nothing renders (replaces the old "no ticket" text).
  noTicketAction?: JSX.Element;
}

export const SelectionCardBody: Component<SelectionCardBodyProps> = (props) => {
  const hasTicket = () => Boolean(props.jiraTicketId);
  const statusChip = () =>
    getStatusChip({
      jiraTicketId: props.jiraTicketId,
      jiraStatus: props.jiraStatus,
      jiraFlagged: props.jiraFlagged,
    });
  const screenshotContext = () => {
    const serverUrl = props.syncServerUrl;
    const workspace = props.syncWorkspace;
    const itemId = props.itemId;
    if (!serverUrl || !workspace || !itemId) return undefined;
    if (!props.hasElementScreenshot && !props.hasFullPageScreenshot)
      return undefined;
    return { serverUrl, workspace, itemId };
  };

  return (
    <SelectionCardBodyLayout
      leading={props.leading}
      subheader={props.subheader}
      summary={
        props.summary ? (
          <div class="text-caption font-medium text-foreground truncate">
            {props.summary}
          </div>
        ) : undefined
      }
      statusPill={
        <Show when={hasTicket()}>
          <StatusChip {...statusChip()} />
        </Show>
      }
      labels={
        <Show when={props.jiraLabels?.length}>
          <For each={props.jiraLabels}>{(label) => <Badge>{label}</Badge>}</For>
        </Show>
      }
      dates={
        <Show
          when={props.timestamp !== undefined ? props.timestamp : undefined}
        >
          {(timestamp) => (
            <div class="flex items-center gap-1.5 mt-1.5 text-meta text-muted-foreground">
              <svg width="12" height="12" viewBox="0 0 16 16">
                <path
                  fill="currentColor"
                  fill-rule="evenodd"
                  d="M4.5 2.5v2H6v-2h4v2h1.5v-2H13a.5.5 0 0 1 .5.5v3h-11V3a.5.5 0 0 1 .5-.5zm-2 5V13a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V7.5zm9-6.5H13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1.5V0H6v1h4V0h1.5z"
                  clip-rule="evenodd"
                />
              </svg>
              <span>{relativeTime(timestamp())}</span>
              <span class="text-muted-foreground/50">{"\u2192"}</span>
              <Show
                when={props.jiraDueDate}
                fallback={<span class="italic">No due date</span>}
              >
                {(dueDate) => <span>{formatDueDate(dueDate())}</span>}
              </Show>
            </div>
          )}
        </Show>
      }
      screenshots={
        <>
          <Show when={screenshotContext()}>
            {(ctx) => {
              const clickable = () => Boolean(props.onScreenshotClick);
              const thumbClass = () =>
                clickable()
                  ? "w-[52px] h-[34px] object-cover border border-border rounded bg-foreground/[0.04] cursor-zoom-in hover:border-primary/60 transition-colors"
                  : "w-[52px] h-[34px] object-cover border border-border rounded bg-foreground/[0.04]";
              return (
                <div class="flex gap-1.5 mt-1.5">
                  <Show when={props.hasElementScreenshot}>
                    <ScreenshotThumb
                      src={screenshotUrl(
                        ctx().serverUrl,
                        ctx().workspace,
                        ctx().itemId,
                        "element",
                      )}
                      label="Element"
                      class={thumbClass()}
                      onOpen={clickable() ? props.onScreenshotClick : undefined}
                    />
                  </Show>
                  <Show when={props.hasFullPageScreenshot}>
                    <ScreenshotThumb
                      src={screenshotUrl(
                        ctx().serverUrl,
                        ctx().workspace,
                        ctx().itemId,
                        "full",
                      )}
                      label="Full page"
                      class={thumbClass()}
                      onOpen={clickable() ? props.onScreenshotClick : undefined}
                    />
                  </Show>
                </div>
              );
            }}
          </Show>
          <Show when={props.recordingUrl}>
            {(recordingUrl) => (
              <a
                data-react-grab-recording-link
                href={recordingUrl()}
                target="_blank"
                rel="noreferrer"
                class="inline-flex items-center gap-1 mt-1.5 text-meta text-primary hover:underline"
              >
                Watch how we got here {"\u2197"}
              </a>
            )}
          </Show>
        </>
      }
      meta={
        <div class="flex items-center gap-1.5 mt-1.5">
          <Show when={props.jiraTicketId}>
            <JiraTicketLink
              ticketId={props.jiraTicketId!}
              url={props.jiraUrl}
              issueType={props.jiraIssueType}
            />
          </Show>

          <span class="flex-1" />

          <PriorityIcon priority={props.jiraPriority ?? undefined} />

          <Show when={props.jiraAssignee}>
            <div class="flex items-center gap-1">
              <Avatar
                name={props.jiraAssignee}
                src={props.jiraAssigneeAvatar}
                size="md"
              />
              <span class="text-meta text-muted-foreground">
                {props.jiraAssignee}
              </span>
            </div>
          </Show>
        </div>
      }
      comments={
        <Show when={hasTicket() && props.onSubmitComment}>
          {(submitComment) => (
            <CommentsSection
              comments={props.jiraComments ?? []}
              onSubmitComment={submitComment()}
              onSearchUsers={props.onSearchUsers}
              onRefreshPoll={props.onRefreshStatus ?? (() => {})}
              commentEditorToolbarVisible={props.commentEditorToolbarVisible}
            />
          )}
        </Show>
      }
      footer={
        <Show when={props.noTicketAction}>
          <hr class="border-border mt-2 mb-1.5" />
          {props.noTicketAction}
        </Show>
      }
    />
  );
};
