import { type Component, type JSX, For, Show } from "solid-js";
import type {
  JiraComment,
  SearchJiraUsersFn,
  SubmitCommentFn,
} from "../../features/jira-comments/types.js";
import { IssueTypeIcon } from "./issue-type-icon.jsx";
import { PriorityIcon } from "./priority-icon.jsx";
import { UserAvatar } from "./UserAvatar.jsx";
import { CommentsSection } from "../jira-comments/comments-section.jsx";
import { relativeTime } from "../../features/sidebar/relative-time.js";
import { screenshotUrl } from "../../features/sidebar/screenshot-url.js";

const getStatusPillClass = (category?: string): string => {
  switch (category) {
    case "indeterminate":
      return "text-blue-400 bg-blue-400/[0.12]";
    case "done":
      return "text-green-400 bg-green-400/[0.12]";
    case "new":
    default:
      return "text-muted-foreground bg-foreground/[0.06]";
  }
};

const getStatusDisplayText = (
  ticketId?: string,
  status?: string,
): string => {
  if (!ticketId) return "no ticket";
  return status ?? "To Do";
};

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
  statusPill?: JSX.Element;
  labels?: JSX.Element;
  dates?: JSX.Element;
  screenshots?: JSX.Element;
  meta?: JSX.Element;
  comments?: JSX.Element;
}

const SelectionCardBodyLayout: Component<SelectionCardBodySlots> = (props) => {
  const hasHeader = () =>
    props.leading !== undefined || props.summary !== undefined;

  return (
    <div data-react-grab-selection-card-body class="w-full">
      <Show when={hasHeader()}>
        <div class="flex items-center gap-2">
          {props.leading}
          {props.summary}
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
      {props.comments}
    </div>
  );
};

export interface SelectionCardBodyProps {
  // Status pill (labels row, right-aligned)
  jiraTicketId?: string;
  jiraStatus?: string;
  jiraStatusCategory?: string;

  // Leading slot — optional element before the summary (e.g. multi-select checkbox)
  leading?: JSX.Element;

  // Summary row — omitted when not provided (e.g. inside the overlay label)
  summary?: string;

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
}

export const SelectionCardBody: Component<SelectionCardBodyProps> = (props) => {
  const hasTicket = () => Boolean(props.jiraTicketId);
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
      summary={
        props.summary
          ? (
              <div class="text-[12px] font-medium text-foreground truncate">
                {props.summary}
              </div>
            )
          : undefined
      }
      statusPill={
        <Show
          when={hasTicket()}
          fallback={
            <span class="text-[9px] uppercase font-medium text-muted-foreground italic">
              no ticket
            </span>
          }
        >
          <span
            class={`text-[9px] uppercase font-medium px-1.5 py-0.5 rounded ${getStatusPillClass(props.jiraStatusCategory)}`}
          >
            {getStatusDisplayText(props.jiraTicketId, props.jiraStatus)}
          </span>
        </Show>
      }
      labels={
        <Show when={props.jiraLabels?.length}>
          <For each={props.jiraLabels}>
            {(label) => (
              <span class="bg-foreground/[0.06] text-muted-foreground text-[9px] font-medium px-1.5 py-0.5 rounded">
                {label}
              </span>
            )}
          </For>
        </Show>
      }
      dates={
        <Show when={props.timestamp !== undefined ? props.timestamp : undefined}>
          {(timestamp) => (
            <div class="flex items-center gap-1.5 mt-1.5 text-[10px] text-muted-foreground">
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
              >
                <path fill="currentColor" fill-rule="evenodd" d="M4.5 2.5v2H6v-2h4v2h1.5v-2H13a.5.5 0 0 1 .5.5v3h-11V3a.5.5 0 0 1 .5-.5zm-2 5V13a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V7.5zm9-6.5H13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1.5V0H6v1h4V0h1.5z" clip-rule="evenodd" />
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
                  {(() => {
                    const src = screenshotUrl(
                      ctx().serverUrl,
                      ctx().workspace,
                      ctx().itemId,
                      "element",
                    );
                    return (
                      <img
                        data-react-grab-screenshot-thumb
                        src={src}
                        alt="Element screenshot"
                        class={thumbClass()}
                        loading="lazy"
                        onClick={
                          clickable()
                            ? () => props.onScreenshotClick?.(src, "Element")
                            : undefined
                        }
                      />
                    );
                  })()}
                </Show>
                <Show when={props.hasFullPageScreenshot}>
                  {(() => {
                    const src = screenshotUrl(
                      ctx().serverUrl,
                      ctx().workspace,
                      ctx().itemId,
                      "full",
                    );
                    return (
                      <img
                        data-react-grab-screenshot-thumb
                        src={src}
                        alt="Full page screenshot"
                        class={thumbClass()}
                        loading="lazy"
                        onClick={
                          clickable()
                            ? () => props.onScreenshotClick?.(src, "Full page")
                            : undefined
                        }
                      />
                    );
                  })()}
                </Show>
              </div>
            );
          }}
        </Show>
      }
      meta={
        <div class="flex items-center gap-1.5 mt-1.5">
          <IssueTypeIcon issueType={props.jiraIssueType ?? undefined} />

          <Show
            when={props.jiraTicketId}
            fallback={
              <span class="font-mono text-[10px] text-muted-foreground italic">
                no ticket
              </span>
            }
          >
            <span class="font-mono text-[10px] text-muted-foreground">
              {props.jiraTicketId}
            </span>
          </Show>

          <span class="flex-1" />

          <PriorityIcon priority={props.jiraPriority ?? undefined} />

          <Show when={props.jiraAssignee}>
            <div class="flex items-center gap-1">
              <UserAvatar
                avatarUrl={props.jiraAssigneeAvatar}
                displayName={props.jiraAssignee ?? undefined}
                size={20}
              />
              <span class="text-[10px] text-muted-foreground">
                {props.jiraAssignee}
              </span>
            </div>
          </Show>
        </div>
      }
      comments={
        <Show when={props.onSubmitComment}>
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
    />
  );
};
