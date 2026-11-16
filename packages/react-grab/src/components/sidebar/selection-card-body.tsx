import { type Component, type JSX, For, Show } from "solid-js";
import type {
  JiraComment,
  SearchJiraUsersFn,
  SubmitCommentFn,
} from "../../features/jira-comments/types.js";
import { JiraTicketLink } from "../jira/jira-ticket-link.jsx";
import { PriorityIcon } from "./priority-icon.jsx";
import { Avatar } from "../ui/avatar.jsx";
import { CommentsSection } from "../jira-comments/comments-section.jsx";
import { relativeTime } from "../../features/sidebar/relative-time.js";
import { useSyncContext } from "../../features/sync/sync-context.js";
import { ScreenshotThumb } from "./screenshot-thumb.js";
import { StatusChip } from "../ui/status-chip.jsx";
import { getStatusChip } from "../../features/sidebar/get-status-chip.js";
import { Badge } from "../ui/badge.jsx";
import { IconCalendar } from "../icons/icon-calendar.jsx";

const formatDueDate = (dueDate: string): string =>
  new Date(dueDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

interface SelectionCardBodySlots {
  /** Before the title (e.g. a multi-select checkbox). */
  leading?: JSX.Element;
  /** The title; the header is omitted when there is none (the overlay label). */
  summary?: JSX.Element;
  /** The element the selection points at, under the title. */
  detail?: JSX.Element;
  /** Trailing header controls (e.g. the card's menu). */
  actions?: JSX.Element;
  /** The header's last row: group picker, then the time. */
  subheader?: JSX.Element;
  time?: JSX.Element;
  ticket?: JSX.Element;
  sections?: JSX.Element;
  comments?: JSX.Element;
  /** The card's main action (e.g. Create Jira ticket). */
  footer?: JSX.Element;
}

/**
 * The card in three zones: a header (title, element, group and time), a body
 * of sections, and a footer with the main action. Spacing lives here, so a
 * section never sets its own margin.
 */
const SelectionCardBodyLayout: Component<SelectionCardBodySlots> = (props) => {
  const hasHeader = () => props.summary !== undefined;

  return (
    <div data-react-grab-selection-card-body class="flex w-full flex-col">
      <Show
        when={hasHeader()}
        fallback={
          <Show when={props.time}>
            <div class="pb-2.5 text-meta text-muted-foreground">
              {props.time}
            </div>
          </Show>
        }
      >
        <div data-react-grab-selection-card-header class="flex flex-col gap-2">
          <div class="flex items-start gap-2">
            {props.leading}
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              {props.summary}
              {props.detail}
            </div>
            {props.actions}
          </div>
          <div class="flex min-w-0 items-center gap-2 text-meta text-muted-foreground">
            {props.subheader}
            {props.time}
          </div>
        </div>
      </Show>
      <div
        class="flex flex-col gap-2.5 [&:not(:has(*))]:hidden"
        classList={{ "mt-3 border-t border-border pt-3": hasHeader() }}
      >
        {props.ticket}
        {props.sections}
        {props.comments}
      </div>
      <Show when={props.footer}>
        <div class="mt-3 border-t border-border pt-3">{props.footer}</div>
      </Show>
    </div>
  );
};

export interface SelectionCardBodyProps {
  // Ticket (status chip, labels, link, priority, assignee, due date)
  jiraTicketId?: string;
  jiraUrl?: string;
  jiraStatus?: string;
  jiraFlagged?: boolean;
  jiraLabels?: readonly string[];
  jiraDueDate?: string | null;
  jiraIssueType?: string | null;
  jiraPriority?: string | null;
  jiraAssignee?: string | null;
  jiraAssigneeAvatar?: string | null;

  // Header — omitted when there is no summary (the overlay label has its own)
  leading?: JSX.Element;
  summary?: string;
  detail?: string;
  actions?: JSX.Element;
  subheader?: JSX.Element;

  // When the selection was made — omitted when undefined (e.g. a
  // primary-selection label that has a ticket but isn't persisted yet)
  timestamp?: number;

  // Screenshot row (item-scoped) — requires itemId and a storage port to render
  itemId?: string;
  hasElementScreenshot?: boolean;
  hasFullPageScreenshot?: boolean;

  // Where the selection is when it is not on the page, and the way back
  // (ADR-0024, ADR-0026).
  locationNote?: JSX.Element;

  // How the user got here: replay, steps and their export (SPEC-020, ADR-0025).
  reproduceSteps?: JSX.Element;

  // Technical details, shown in dev mode.
  devInsights?: JSX.Element;

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

  // The footer's main action when no ticket exists.
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
  const { storage } = useSyncContext();
  const screenshotItemId = () => {
    const itemId = props.itemId;
    if (!itemId || !storage()) return undefined;
    if (!props.hasElementScreenshot && !props.hasFullPageScreenshot)
      return undefined;
    return itemId;
  };

  return (
    <SelectionCardBodyLayout
      leading={props.leading}
      actions={props.actions}
      subheader={props.subheader}
      summary={
        props.summary ? (
          <div class="line-clamp-2 text-body leading-5 font-medium text-foreground">
            {props.summary}
          </div>
        ) : undefined
      }
      detail={
        props.detail ? (
          <div class="truncate font-mono text-meta text-muted-foreground">
            {props.detail}
          </div>
        ) : undefined
      }
      time={
        props.timestamp !== undefined ? (
          <span data-react-grab-selection-card-time class="shrink-0">
            {relativeTime(props.timestamp)}
          </span>
        ) : undefined
      }
      ticket={
        <Show when={hasTicket()}>
          <div
            data-react-grab-selection-card-ticket
            class="flex flex-col gap-1.5"
          >
            <div class="flex items-center gap-1.5">
              <JiraTicketLink
                ticketId={props.jiraTicketId!}
                url={props.jiraUrl}
                issueType={props.jiraIssueType}
              />
              <span class="flex-1" />
              <StatusChip {...statusChip()} />
            </div>
            <div class="flex flex-wrap items-center gap-1.5 [&:not(:has(*))]:hidden">
              <For each={props.jiraLabels ?? []}>
                {(label) => <Badge>{label}</Badge>}
              </For>
              <Show when={props.jiraDueDate}>
                {(dueDate) => (
                  <Badge>
                    <IconCalendar size={10} />
                    Due {formatDueDate(dueDate())}
                  </Badge>
                )}
              </Show>
              <Show when={props.jiraPriority || props.jiraAssignee}>
                <span class="flex flex-1 items-center justify-end gap-1.5">
                  <PriorityIcon priority={props.jiraPriority ?? undefined} />
                  <Show when={props.jiraAssignee}>
                    <Avatar
                      name={props.jiraAssignee}
                      src={props.jiraAssigneeAvatar}
                      size="md"
                    />
                    <span class="text-meta text-muted-foreground">
                      {props.jiraAssignee}
                    </span>
                  </Show>
                </span>
              </Show>
            </div>
          </div>
        </Show>
      }
      sections={
        <>
          {props.locationNote}
          {props.reproduceSteps}
          <Show when={screenshotItemId()}>
            {(itemId) => {
              const clickable = () => Boolean(props.onScreenshotClick);
              const thumbClass = () =>
                clickable()
                  ? "w-[64px] h-[40px] object-cover border border-border rounded-md bg-foreground/[0.04] cursor-zoom-in hover:border-primary/60 transition-colors"
                  : "w-[64px] h-[40px] object-cover border border-border rounded-md bg-foreground/[0.04]";
              return (
                <div class="flex gap-1.5">
                  <Show when={props.hasElementScreenshot}>
                    <ScreenshotThumb
                      screenshot={{ selectionId: itemId(), kind: "element" }}
                      label="Element"
                      class={thumbClass()}
                      onOpen={clickable() ? props.onScreenshotClick : undefined}
                    />
                  </Show>
                  <Show when={props.hasFullPageScreenshot}>
                    <ScreenshotThumb
                      screenshot={{ selectionId: itemId(), kind: "full" }}
                      label="Full page"
                      class={thumbClass()}
                      onOpen={clickable() ? props.onScreenshotClick : undefined}
                    />
                  </Show>
                </div>
              );
            }}
          </Show>
          {props.devInsights}
        </>
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
      footer={props.noTicketAction}
    />
  );
};
