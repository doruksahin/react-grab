import {
  type Component,
  createMemo,
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
import { StepList } from "../reproduce-steps/step-list.jsx";
import { RemoveSelectionButton } from "../remove-selection-button.jsx";
import { LocationNote } from "../selection-location/location-note.jsx";
import { SelectionTreeView } from "../selection-groups/selection-tree-view.jsx";
import { selectionTree } from "../../features/selection-groups/business/selection-tree.js";
import { narrowSelectionTree } from "../../features/selection-groups/business/narrow-selection-tree.js";
import { selectionRowFields } from "../../features/selection-groups/business/selection-row-fields.js";
import { GroupTicketSummary } from "./group-ticket-summary.jsx";

interface SelectionTreePanelProps {
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
  /** Remove a selection; shown only when `canRemoveItem` allows it (ADR-0008). */
  onRemoveItem?: (itemId: string) => void;
  canRemoveItem?: (itemId: string) => boolean;
  onAddGroup?: (name: string) => void;
  /** Scroll to, focus and briefly mark a selection (a label's "Open thread"). */
  focusRequest?: SidebarFocusRequest | null;
  onRenameGroup?: (groupId: string, name: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onToggleGroupRevealed?: (groupId: string) => void;
  onCopyGroup?: (groupId: string) => void;
  onOpenGroupDetail?: (groupId: string) => void;
}

/**
 * The sidebar's list of selections, as one tree (ADR-0028): Ungrouped first,
 * then each group, drawn with the comments menu's own SelectionTreeView.
 * Every selection keeps its full card under its section.
 */
export const SelectionTreePanel: Component<SelectionTreePanelProps> = (
  props,
) => {
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

  const allowedGroupIds = createMemo(() => {
    const filter = props.filter;
    if (!filter || !isFilterActive(filter)) return null;
    return new Set(applyFilters(props.groups, filter).map((g) => g.id));
  });

  // Search and Flagged pick selections. Search reads what a row shows.
  const itemFilter = createMemo(() => {
    const query = props.searchQuery?.toLowerCase();
    const flaggedOnly = Boolean(props.flaggedOnly);
    if (!query && !flaggedOnly) return undefined;
    return (item: CommentItem) => {
      if (query) {
        const { title, detail } = selectionRowFields(item);
        const text = `${title} ${detail ?? ""}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      if (flaggedOnly) {
        const group = item.groupId ? groupMap().get(item.groupId) : undefined;
        if (group?.jiraFlagged !== true) return false;
      }
      return true;
    };
  });

  const renderCard = (item: CommentItem) => {
    const group = () =>
      item.groupId ? groupMap().get(item.groupId) : undefined;
    const isFlagged = () => group()?.jiraFlagged === true;
    const checkable = () =>
      !isSelectionLocked({ groupId: item.groupId }, props.groups);
    const isSelected = () => props.selectedIds?.has(item.id) === true;
    const summary = () => selectionRowFields(item).title;

    const boundComments = () => {
      const g = group();
      const callbacks = commentCallbacks();
      if (!g || !callbacks) return undefined;
      return bindGroupCommentCallbacks(g.id, callbacks);
    };

    return (
      <div class="px-2 pb-2.5">
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
              <>
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
                <Show when={props.canRemoveItem?.(item.id)}>
                  <RemoveSelectionButton
                    onRemove={() => props.onRemoveItem?.(item.id)}
                  />
                </Show>
              </>
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
            reproduceSteps={<StepList item={item} />}
            locationNote={<LocationNote selectionId={item.id} class="mt-1.5" />}
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
              <DevInsights.Field label="tag" value={item.tagName} kind="tag" />
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
      </div>
    );
  };

  const tree = createMemo(() =>
    selectionTree(props.commentItems, props.groups),
  );

  const visibleTree = createMemo(() =>
    narrowSelectionTree(tree(), {
      itemFilter: itemFilter(),
      allowedGroupIds: allowedGroupIds(),
    }),
  );

  const isEmpty = () =>
    visibleTree().ungrouped.length === 0 && visibleTree().groups.length === 0;

  return (
    <div
      data-react-grab-selection-tree
      role="region"
      aria-label="Selections"
      class="flex-1 overflow-y-auto py-1"
    >
      <Show when={isEmpty()}>
        <div class="py-8 text-center text-caption text-muted-foreground italic">
          No matching selections
        </div>
      </Show>
      <SelectionTreeView
        tree={visibleTree()}
        revealItemId={props.focusRequest?.itemId}
        renderItem={renderCard}
        onRenameGroup={props.onRenameGroup}
        onDeleteGroup={props.onDeleteGroup}
        onToggleGroupRevealed={props.onToggleGroupRevealed}
        onCopyGroup={props.onCopyGroup}
        groupHeaderExtra={(group) => (
          <GroupTicketSummary
            group={group}
            onOpenDetail={() => props.onOpenGroupDetail?.(group.id)}
          />
        )}
      />
    </div>
  );
};
