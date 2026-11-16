import {
  type Component,
  createMemo,
  createSignal,
  createEffect,
  For,
  on,
  onCleanup,
  Show,
} from "solid-js";
import { Key } from "@solid-primitives/keyed";
import type { CommentItem } from "../../types.js";
import type { SelectionGroupWithJira } from "../../features/selection-groups/types.js";
import type { SelectionTree } from "../../features/selection-groups/business/selection-tree.js";
import type { StatusSection } from "../../features/sidebar/business/sections-by-status.js";
import { statusCounts } from "../../features/sidebar/business/status-filter.js";
import { bindGroupCommentCallbacks } from "../../features/jira-comments/bind-group-callbacks.js";
import { useGroupCommentCallbacks } from "../../features/jira-comments/hooks/use-group-comment-callbacks.js";
import { useImageLightbox } from "../../features/image-lightbox/index.js";
import { isSelectionLocked } from "../../features/selection-groups/business/ticket-lock.js";
import { moveDestinations } from "../../features/selection-groups/business/move-destinations.js";
import type { SidebarFocusRequest } from "../../features/sidebar/hooks/use-sidebar-session.js";
import { SIDEBAR_FOCUS_HIGHLIGHT_MS } from "../../constants.js";
import { cn } from "../../utils/cn.js";
import { StatusDot } from "../ui/status-dot.js";
import { SelectionCheckbox } from "../ui/selection-checkbox.js";
import { SelectionCardBody } from "./selection-card-body.js";
import { SelectionRow } from "./selection-row.jsx";
import { CreateTicketButton } from "../jira/create-ticket-button.js";
import { SelectionDevInsights } from "../dev-insights/selection-dev-insights.jsx";
import { ActiveGroupPicker } from "../selection-groups/active-group-picker.js";
import { ReproducePanel } from "../reproduce-steps/reproduce-panel.jsx";
import { LocationNotice } from "../selection-location/location-notice.jsx";
import { SelectionMenu } from "../selection/selection-menu.jsx";
import { SelectionTreeView } from "../selection-groups/selection-tree-view.jsx";
import { SelectionSection } from "../selection-groups/ungrouped-section.jsx";
import { GroupTicketSummary } from "./group-ticket-summary.jsx";
import type { SelectionGrouping } from "./list-view-controls.jsx";

interface SelectionTreePanelProps {
  /** The selections by group, as the sidebar's filters and order leave them. */
  tree: SelectionTree<SelectionGroupWithJira>;
  /** The same selections by status. */
  statusSections: StatusSection<CommentItem>[];
  grouping: SelectionGrouping;
  statusOf: (item: CommentItem) => string;
  groups: SelectionGroupWithJira[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  commentEditorToolbarVisible?: boolean;
  onCreateTicket?: (item: CommentItem) => void;
  onMoveItem?: (itemId: string, groupId: string | null) => void;
  /** Remove a selection; shown only when `canRemoveItem` allows it (ADR-0008). */
  onRemoveItem?: (itemId: string) => void;
  canRemoveItem?: (itemId: string) => boolean;
  onAddGroup?: (name: string) => void;
  /** Scroll to, open and briefly mark a selection (a label's "Open thread"). */
  focusRequest?: SidebarFocusRequest | null;
  onRenameGroup?: (groupId: string, name: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onToggleGroupRevealed?: (groupId: string) => void;
  onCopyGroup?: (groupId: string) => void;
  onOpenGroupDetail?: (groupId: string) => void;
}

/**
 * The sidebar's list of selections: one short row each, opening its card
 * underneath one at a time, in sections by group (ADR-0028) or by status.
 */
export const SelectionTreePanel: Component<SelectionTreePanelProps> = (
  props,
) => {
  const lightbox = useImageLightbox();
  const commentCallbacks = useGroupCommentCallbacks();

  const [openItemId, setOpenItemId] = createSignal<string | null>(null);
  const [highlightedItemId, setHighlightedItemId] = createSignal<string | null>(
    null,
  );
  // Rows by selection id, for a focus request to scroll to.
  const rowElements = new Map<string, HTMLElement>();

  // Once per request: open the card, scroll to it, focus it and mark it
  // until the timer runs out or the user moves on.
  createEffect(
    on(
      () => props.focusRequest,
      (request) => {
        if (!request) return;
        setOpenItemId(request.itemId);
        const frame = requestAnimationFrame(() => {
          const row = rowElements.get(request.itemId);
          if (!row) return;
          row.scrollIntoView({ block: "center" });
          row.focus({ preventScroll: true });
          setHighlightedItemId(request.itemId);
          row.addEventListener("blur", () => setHighlightedItemId(null), {
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

  const groupMap = createMemo(
    () => new Map(props.groups.map((group) => [group.id, group])),
  );

  const sectionSummary = (items: CommentItem[]) => (
    <span
      data-react-grab-section-summary
      class="flex shrink-0 items-center gap-2 text-meta tabular-nums text-muted-foreground"
    >
      <For each={statusCounts(items.map(props.statusOf))}>
        {(entry) => (
          <span class="flex items-center gap-1" title={entry.status}>
            <StatusDot color={entry.color.hex} />
            {entry.count}
            <span class="sr-only">{entry.status}</span>
          </span>
        )}
      </For>
    </span>
  );

  const renderRow = (item: CommentItem) => {
    const group = () =>
      item.groupId ? groupMap().get(item.groupId) : undefined;
    const checkable = () =>
      !isSelectionLocked({ groupId: item.groupId }, props.groups);
    const isSelected = () => props.selectedIds?.has(item.id) === true;
    const isBulkSelecting = () => (props.selectedIds?.size ?? 0) > 0;
    const destinations = () => moveDestinations(item, props.groups);
    const canRemove = () => Boolean(props.canRemoveItem?.(item.id));

    const boundComments = () => {
      const currentGroup = group();
      const callbacks = commentCallbacks();
      if (!currentGroup || !callbacks) return undefined;
      return bindGroupCommentCallbacks(currentGroup.id, callbacks);
    };

    return (
      <SelectionRow
        item={item}
        status={props.statusOf(item)}
        ticketId={group()?.jiraTicketId}
        flagged={group()?.jiraFlagged === true}
        highlighted={item.id === highlightedItemId()}
        open={openItemId() === item.id}
        onOpenChange={(open) => setOpenItemId(open ? item.id : null)}
        ref={(element) => {
          rowElements.set(item.id, element);
          onCleanup(() => {
            if (rowElements.get(item.id) === element) {
              rowElements.delete(item.id);
            }
          });
        }}
        leading={
          !props.onToggleSelect ? undefined : !checkable() ? (
            <span class="block size-3.5" aria-hidden="true" />
          ) : (
            <SelectionCheckbox
              checked={isSelected()}
              label="Select for bulk actions"
              onToggle={() => props.onToggleSelect?.(item.id)}
              class={cn(
                "transition-opacity",
                !isBulkSelecting() &&
                  "opacity-0 group-hover/row:opacity-100 focus-within:opacity-100",
              )}
            />
          )
        }
        actions={
          <Show when={destinations().length > 0 || canRemove()}>
            <SelectionMenu
              destinations={destinations()}
              onMove={(groupId) => props.onMoveItem?.(item.id, groupId)}
              onRemove={
                canRemove() ? () => props.onRemoveItem?.(item.id) : undefined
              }
            />
          </Show>
        }
      >
        <SelectionCardBody
          ticketDisplay="link"
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
                onClick={() => props.onCreateTicket?.(item)}
                class="w-full"
              />
            ) : undefined
          }
          itemId={item.id}
          hasElementScreenshot={Boolean(item.screenshotElement)}
          hasFullPageScreenshot={Boolean(item.screenshotFullPage)}
          reproduceSteps={<ReproducePanel item={item} />}
          locationNote={<LocationNotice selectionId={item.id} />}
          devInsights={<SelectionDevInsights item={item} />}
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
          commentsDefaultOpen={props.focusRequest?.itemId === item.id}
          onSubmitComment={boundComments()?.onSubmitComment}
          onSearchUsers={boundComments()?.onSearchUsers}
          onRefreshStatus={boundComments()?.onRefreshPoll}
          commentEditorToolbarVisible={props.commentEditorToolbarVisible}
          onScreenshotClick={(src, label) => lightbox.open(src, label)}
        />
      </SelectionRow>
    );
  };

  const isEmpty = () =>
    props.grouping === "status"
      ? props.statusSections.length === 0
      : props.tree.ungrouped.length === 0 && props.tree.groups.length === 0;

  return (
    <div
      data-react-grab-selection-tree
      role="region"
      aria-label="Selections"
      class="flex-1 overflow-y-auto pb-1"
    >
      <Show when={isEmpty()}>
        <div class="py-8 text-center text-caption text-muted-foreground italic">
          No matching selections
        </div>
      </Show>
      <Show
        when={props.grouping === "status"}
        fallback={
          <SelectionTreeView
            tree={props.tree}
            revealItemId={props.focusRequest?.itemId}
            renderItem={renderRow}
            ungroupedSummary={sectionSummary}
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
        }
      >
        <Key each={props.statusSections} by={(section) => section.status}>
          {(section, index) => (
            <div data-react-grab-status-section>
              <SelectionSection
                title={section().status}
                items={section().items}
                isFirst={index() === 0}
                revealItemId={props.focusRequest?.itemId}
                renderItem={renderRow}
              />
            </div>
          )}
        </Key>
      </Show>
    </div>
  );
};
