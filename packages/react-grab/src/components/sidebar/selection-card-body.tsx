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
import { IconOpen } from "../icons/icon-open.jsx";
import { buttonVariants } from "../ui/button.js";
import { cn } from "../../utils/cn.js";

const formatDueDate = (dueDate: string): string =>
  new Date(dueDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

interface SelectionCardBodySlots {
  /** Before the title (e.g. a multi-select checkbox). */
  leading?: JSX.Element;
  /** The title; the header is omitted when there is none (a list row or the
   *  overlay label already shows it). */
  summary?: JSX.Element;
  /** The element the selection points at, under the title. */
  detail?: JSX.Element;
  /** Trailing header controls (e.g. the card's menu). */
  actions?: JSX.Element;
  /** The group picker. */
  subheader?: JSX.Element;
  time?: JSX.Element;
  /** Status, priority, people, labels and dates as one line of chips. */
  facts?: JSX.Element;
  /** What needs a look first: where it is, screenshots. */
  notices?: JSX.Element;
  /** Flat, collapsible sections divided by lines (steps, comments, dev). */
  rows?: JSX.Element;
  /** The card's main action (e.g. Create Jira ticket). */
  footer?: JSX.Element;
}

/**
 * The card: an optional header, one line of properties, notices, flat
 * sections, and the main action. Spacing lives here, so a section never
 * sets its own margin.
 */
const SelectionCardBodyLayout: Component<SelectionCardBodySlots> = (props) => {
  const hasHeader = () => props.summary !== undefined;

  return (
    <div
      data-react-grab-selection-card-body
      class="flex w-full flex-col gap-2.5"
    >
      <Show when={hasHeader()}>
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
        data-react-grab-selection-card-facts
        class="flex min-w-0 flex-wrap items-center gap-1.5 text-meta text-muted-foreground [&:not(:has(*))]:hidden"
      >
        {props.facts}
        <Show when={!hasHeader()}>
          {props.subheader}
          {props.time}
        </Show>
      </div>
      <div class="flex flex-col gap-2.5 [&:not(:has(*))]:hidden">
        {props.notices}
      </div>
      <div class="flex flex-col [&:not(:has(*))]:hidden">{props.rows}</div>
      <Show when={props.footer}>{props.footer}</Show>
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

  /** Who made the selection, by their Jira name (ADR-0031). */
  capturedBy?: string;

  /** How the ticket shows among the properties: its key ("key", the default)
   *  or only a link to Jira ("link"), when a list row already shows the key. */
  ticketDisplay?: "key" | "link";

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
  /** Whether the comments start open. @default true */
  commentsDefaultOpen?: boolean;

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
      facts={
        <>
          <Show when={props.capturedBy}>
            {(name) => (
              <span class="flex basis-full min-w-0 items-center gap-1 text-muted-foreground">
                Captured by
                <Avatar name={name()} size="sm" />
                <span class="truncate text-foreground">{name()}</span>
              </span>
            )}
          </Show>
          <Show when={hasTicket()}>
            <StatusChip {...statusChip()} />
            <Show
              when={props.ticketDisplay === "link"}
              fallback={
                <JiraTicketLink
                  ticketId={props.jiraTicketId!}
                  url={props.jiraUrl}
                  issueType={props.jiraIssueType}
                />
              }
            >
              <Show when={props.jiraUrl}>
                {(url) => (
                  <a
                    data-react-grab-ignore-events
                    data-react-grab-jira-open
                    href={url()}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${props.jiraTicketId} in Jira`}
                    title={`Open ${props.jiraTicketId} in Jira`}
                    class={cn(
                      buttonVariants({ variant: "subtle", size: "icon-xs" }),
                    )}
                  >
                    <IconOpen size={11} />
                  </a>
                )}
              </Show>
            </Show>
          </Show>
          <Show when={props.jiraPriority}>
            {(priority) => (
              <span
                class="flex items-center gap-1"
                title={`Priority: ${priority()}`}
              >
                <PriorityIcon priority={priority()} />
                {priority()}
              </span>
            )}
          </Show>
          <Show when={props.jiraAssignee}>
            <span class="flex min-w-0 items-center gap-1">
              <span class="text-muted-foreground">Assignee</span>
              <Avatar
                name={props.jiraAssignee}
                src={props.jiraAssigneeAvatar}
                size="sm"
              />
              <span class="truncate">{props.jiraAssignee}</span>
            </span>
          </Show>
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
        </>
      }
      notices={
        <>
          {props.locationNote}
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
        </>
      }
      rows={
        <>
          {props.reproduceSteps}
          <Show when={hasTicket() && props.onSubmitComment}>
            {(submitComment) => (
              <CommentsSection
                comments={props.jiraComments ?? []}
                onSubmitComment={submitComment()}
                onSearchUsers={props.onSearchUsers}
                onRefreshPoll={props.onRefreshStatus ?? (() => {})}
                commentEditorToolbarVisible={props.commentEditorToolbarVisible}
                defaultOpen={props.commentsDefaultOpen}
              />
            )}
          </Show>
          {props.devInsights}
        </>
      }
      footer={props.noTicketAction}
    />
  );
};
