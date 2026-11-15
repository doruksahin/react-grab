import {
  type Component,
  createMemo,
  For,
  Show,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from "solid-js";
import type { CommentItem } from "../../types.js";
import type { SelectionGroupWithJira } from "../../features/selection-groups/types.js";
import {
  applyFilters,
  type FilterState,
  isFilterActive,
} from "../../features/sidebar/filter-state.js";
import { bindGroupCommentCallbacks } from "../../features/jira-comments/bind-group-callbacks.js";
import { useGroupCommentCallbacks } from "../../features/jira-comments/hooks/use-group-comment-callbacks.js";
import { useImageLightbox } from "../../features/image-lightbox/index.js";
import { isSelectionLocked } from "../../features/selection-groups/business/ticket-lock.js";
import { SelectionCardBody } from "./selection-card-body.js";
import { SelectionCheckbox } from "../ui/selection-checkbox.js";
import { SelectionCard } from "../selection/selection-card.js";
import type { SidebarFocusRequest } from "../../features/sidebar/hooks/use-sidebar-session.js";
import { SIDEBAR_FOCUS_HIGHLIGHT_MS } from "../../constants.js";
import { CreateTicketButton } from "../jira/create-ticket-button.js";
import { DevInsights } from "../dev-insights/index.js";
import { useDevMode } from "../../features/dev-mode/index.js";
import { ActiveGroupPicker } from "../selection-groups/active-group-picker.js";

interface SelectionListTabProps {
  commentItems: CommentItem[];
  groups: SelectionGroupWithJira[];
  filter?: FilterState;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  searchQuery?: string;
  flaggedOnly?: boolean;
  commentEditorToolbarVisible?: boolean;
  onCreateTicket?: (item: CommentItem) => void;
  onMoveItem?: (itemId: string, groupId: string | null) => void;
  onAddGroup?: (name: string) => void;
  /** Scroll to, focus and briefly mark a selection (a label's "Open thread"). */
  focusRequest?: SidebarFocusRequest | null;
}

export const SelectionListTab: Component<SelectionListTabProps> = (props) => {
  const isDevMode = useDevMode();
  const lightbox = useImageLightbox();

  // Cards by selection id, for a focus request to scroll to.
  const cardElements = new Map<string, HTMLElement>();
  const [highlightedItemId, setHighlightedItemId] = createSignal<string | null>(
    null,
  );

  // Once per request: scroll to the card, move focus to it and mark it until
  // the timer runs out or the user moves on.
  createEffect(
    on(
      () => props.focusRequest,
      (request) => {
        if (!request) return;
        const frame = requestAnimationFrame(() => {
          const card = cardElements.get(request.itemId);
          if (!card) return;
          card.scrollIntoView({ block: "center" });
          card.focus({ preventScroll: true });
          setHighlightedItemId(request.itemId);
          card.addEventListener("blur", () => setHighlightedItemId(null), {
            once: true,
          });
        });
        const timeoutId = setTimeout(
          () => setHighlightedItemId(null),
          SIDEBAR_FOCUS_HIGHLIGHT_MS,
        );
        onCleanup(() => {
          cancelAnimationFrame(frame);
          clearTimeout(timeoutId);
        });
      },
    ),
  );

  const commentCallbacks = useGroupCommentCallbacks();

  const groupMap = createMemo(
    () => new Map(props.groups.map((g) => [g.id, g])),
  );

  const filteredItems = () => {
    let items = props.commentItems;

    const query = props.searchQuery?.toLowerCase();
    if (query) {
      items = items.filter((item) => {
        const text = (
          item.commentText ??
          item.componentName ??
          item.tagName
        ).toLowerCase();
        return text.includes(query);
      });
    }

    if (props.flaggedOnly) {
      items = items.filter((item) => {
        if (!item.groupId) return false;
        const group = groupMap().get(item.groupId);
        return group?.jiraFlagged === true;
      });
    }

    const filter = props.filter;
    if (filter && isFilterActive(filter)) {
      const allowedGroupIds = new Set(
        applyFilters(props.groups, filter).map((g) => g.id),
      );
      items = items.filter(
        (item) => item.groupId != null && allowedGroupIds.has(item.groupId),
      );
    }

    return items;
  };

  return (
    <div class="flex-1 overflow-y-auto p-2 flex flex-col gap-2.5">
      <Show when={filteredItems().length === 0}>
        <div class="py-8 text-center text-caption text-muted-foreground italic">
          No matching selections
        </div>
      </Show>
      <For each={filteredItems()}>
        {(item) => {
          const group = () =>
            item.groupId ? groupMap().get(item.groupId) : undefined;
          const isFlagged = () => group()?.jiraFlagged === true;
          const checkable = () =>
            !isSelectionLocked({ groupId: item.groupId }, props.groups);
          const isSelected = () => props.selectedIds?.has(item.id) === true;
          const summary = () =>
            item.commentText || item.componentName || item.tagName;

          const boundComments = () => {
            const g = group();
            const callbacks = commentCallbacks();
            if (!g || !callbacks) return undefined;
            return bindGroupCommentCallbacks(g.id, callbacks);
          };

          return (
            <SelectionCard
              flagged={isFlagged()}
              selected={isSelected()}
              tabIndex={-1}
              class={
                item.id === highlightedItemId()
                  ? "ring-1 ring-selection outline-none"
                  : "outline-none"
              }
              ref={(element) => {
                cardElements.set(item.id, element);
                onCleanup(() => {
                  if (cardElements.get(item.id) === element) {
                    cardElements.delete(item.id);
                  }
                });
              }}
            >
              <SelectionCardBody
                leading={
                  props.onToggleSelect && checkable() ? (
                    <SelectionCheckbox
                      checked={isSelected()}
                      onToggle={() => props.onToggleSelect?.(item.id)}
                    />
                  ) : undefined
                }
                subheader={
                  <ActiveGroupPicker
                    groups={props.groups}
                    activeGroupId={item.groupId}
                    onActiveGroupChange={(groupId) =>
                      props.onMoveItem?.(item.id, groupId)
                    }
                    onAddGroup={props.onAddGroup}
                  >
                    <ActiveGroupPicker.Trigger />
                    <ActiveGroupPicker.Content />
                  </ActiveGroupPicker>
                }
                noTicketAction={
                  !group()?.jiraTicketId && props.onCreateTicket ? (
                    <CreateTicketButton
                      onClick={() => props.onCreateTicket!(item)}
                      class="w-full"
                    />
                  ) : undefined
                }
                summary={summary()}
                timestamp={item.timestamp}
                itemId={item.id}
                hasElementScreenshot={Boolean(item.screenshotElement)}
                hasFullPageScreenshot={Boolean(item.screenshotFullPage)}
                recordingUrl={item.recordingUrl}
                jiraTicketId={group()?.jiraTicketId}
                jiraUrl={group()?.jiraUrl}
                jiraStatus={group()?.jiraStatus}
                jiraFlagged={group()?.jiraFlagged}
                jiraLabels={group()?.jiraLabels}
                jiraDueDate={group()?.jiraDueDate}
                jiraIssueType={group()?.jiraIssueType}
                jiraPriority={group()?.jiraPriority}
                jiraAssignee={group()?.jiraAssignee}
                jiraAssigneeAvatar={group()?.jiraAssigneeAvatar}
                jiraComments={group()?.jiraComments}
                onSubmitComment={boundComments()?.onSubmitComment}
                onSearchUsers={boundComments()?.onSearchUsers}
                onRefreshStatus={boundComments()?.onRefreshPoll}
                commentEditorToolbarVisible={props.commentEditorToolbarVisible}
                onScreenshotClick={(src, label) => lightbox.open(src, label)}
              />
              <Show when={isDevMode()}>
                <DevInsights>
                  <DevInsights.Field
                    label="tag"
                    value={item.tagName}
                    kind="tag"
                  />
                  <DevInsights.Field
                    label="node"
                    value={item.componentName ?? item.elementName}
                    kind="component"
                  />
                  <DevInsights.Attributes content={item.content} />
                  <Show when={item.elementSelectors?.[0]}>
                    <DevInsights.Section label="selector">
                      <span class="text-meta font-mono text-foreground/80 break-all">
                        {item.elementSelectors?.[0]}
                      </span>
                    </DevInsights.Section>
                  </Show>
                  <DevInsights.Section label="html">
                    <pre class="text-meta font-mono text-foreground/80 whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto leading-relaxed">
                      {item.content}
                    </pre>
                  </DevInsights.Section>
                </DevInsights>
              </Show>
            </SelectionCard>
          );
        }}
      </For>
    </div>
  );
};
