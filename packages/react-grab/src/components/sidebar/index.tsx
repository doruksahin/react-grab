// packages/react-grab/src/components/sidebar/index.tsx
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  on,
  Show,
  untrack,
} from "solid-js";
import createFocusTrap from "solid-focus-trap";
import { cn } from "../../utils/cn.js";
import type { CommentItem, TicketCreatedCallback } from "../../types.js";
import type { SyncStatus } from "../../features/sync/types.js";
import type { SidebarFocusRequest } from "../../features/sidebar/hooks/use-sidebar-session.js";
import { SidebarHeader } from "./sidebar-header.js";
import { EmptyState } from "./empty-state.js";
import { StatusFilter } from "./status-filter.js";
import { isArchived } from "../../features/selection-groups/business/archive-policy.js";
import {
  ListViewControls,
  type SelectionGrouping,
} from "./list-view-controls.jsx";
import { useSidebarSelections } from "../../features/sidebar/hooks/use-sidebar-selections.js";
import type { SelectionOrder } from "../../features/sidebar/business/order-selections.js";
import { SyncOfflineBanner } from "./sync-offline-banner.js";
import { FilterMenu } from "./filter-menu.js";
import { FilterChips } from "./filter-chips.js";
import {
  type FilterState,
  EMPTY_FILTER,
  isFilterActive,
  applyFilters,
  getDistinctAssignees,
  getDistinctCapturers,
  getDistinctReporters,
  getDistinctLabels,
} from "../../features/sidebar/filter-state.js";
import { GroupDetailView } from "./group-detail-view.js";
import { StatusLegend } from "./status-legend.js";
import type { SelectionGroupWithJira } from "../../features/selection-groups/types.js";
import { presentedGroups } from "../../features/selection-groups/business/membership.js";
import { JiraCreateDialog } from "./jira-create-dialog.jsx";
import { SelectionTreePanel } from "./selection-tree-panel.js";
import { BulkActionBar } from "./bulk-action-bar.js";
import { BulkGroupPicker } from "./bulk-group-picker.js";
import { isSelectionLocked } from "../../features/selection-groups/business/ticket-lock.js";
import { assignableGroupsFor } from "../../features/selection-groups/business/membership-policy.js";
import { ImageLightbox } from "../ui/image-lightbox.js";
import { useImageLightbox } from "../../features/image-lightbox/index.js";
import { IconFlag } from "../icons/icon-flag.js";
import { IconButton } from "../ui/icon-button.js";
import type { ArchiveHandlers } from "../selection/archive-actions.js";

export interface SidebarProps {
  groups: SelectionGroupWithJira[];
  commentItems: CommentItem[];
  syncStatus: SyncStatus;
  onRetrySync?: () => Promise<void>;
  onClose: () => void;
  /** Open on this selection, where its Jira thread is (a label's "Open
   *  thread"); a new object for every request. */
  focusRequest?: SidebarFocusRequest | null;
  onActiveDetailGroupChange: (groupId: string | null) => void;
  onJiraResolved?: (groupId: string) => void;
  onTicketCreated?: TicketCreatedCallback;
  onFilterVisibilityChange?: (
    visibleIds: Set<string>,
    allGroupIds: string[],
  ) => void;
  onCreateTicketForLooseItem?: (item: CommentItem) => void;
  onRemoveItem?: (itemId: string) => void;
  canRemoveItem?: (itemId: string) => boolean;
  /** Archive, restore and delete from the archive (ADR-0030). */
  archive?: ArchiveHandlers;
  onMoveItem?: (itemId: string, groupId: string | null) => void;
  onMoveItems?: (itemIds: Set<string>, groupId: string) => void;
  onAddGroup?: (name: string) => void;
  onRenameGroup?: (groupId: string, name: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onToggleGroupRevealed?: (groupId: string) => void;
  onCopyGroup?: (groupId: string) => void;
  /** When set, opens the Jira create dialog for this loose item + its synthetic group. */
  looseTicketDialog?: {
    group: SelectionGroupWithJira;
    items: CommentItem[];
  } | null;
  onLooseTicketDialogClose?: () => void;
  commentEditorToolbarVisible?: boolean;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  // Instance-scoped (not module-scoped) — safe for multiple Sidebar instances
  // The group whose detail view was last opened, to return focus to it.
  let lastDetailGroupId: string | undefined;
  let detailViewRef: HTMLDivElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  const lightbox = useImageLightbox();

  // Trap focus inside the sidebar for the duration it is mounted.
  // solid-focus-trap restores focus to the previously focused element on cleanup.
  // Focus starts on the dialog itself: its first control is the minor
  // "Status legend" button (WAI-ARIA dialog pattern).
  createFocusTrap({
    element: () => containerRef ?? null,
    initialFocusElement: () => containerRef ?? null,
    // Opened on a selection: the tree panel moves focus to its card.
    onInitialFocus: (event: Event) => {
      if (untrack(() => props.focusRequest)) event.preventDefault();
    },
    // The lightbox is a modal dialog with its own focus trap.
    enabled: () => !lightbox.state().open,
  });

  // Synthetic groups are invisible in user-facing surfaces (filter chips,
  // stats bar, empty-state guard). Their selections show as Ungrouped in
  // the selection tree (ADR-0028).
  // Archived groups stay out of the filters (ADR-0030).
  const userFacingGroups = createMemo(() =>
    presentedGroups(
      props.groups.filter((group) => !isArchived(group)),
      props.commentItems,
    ),
  );

  // A focus request shows the tree; the tree scrolls to the card.
  createEffect(
    on(
      () => props.focusRequest,
      (request) => {
        if (request) setActiveDetailGroupId(null);
      },
    ),
  );
  const [showLegend, setShowLegend] = createSignal(false);
  const [filterState, setFilterState] = createSignal<FilterState>(EMPTY_FILTER);
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = createSignal("");
  const [flaggedOnly, setFlaggedOnly] = createSignal(false);
  const [attentionOnly, setAttentionOnly] = createSignal(false);
  const [grouping, setGrouping] = createSignal<SelectionGrouping>("group");
  const [order, setOrder] = createSignal<SelectionOrder>("attention");

  // The chips keep Attention and a status apart; a status chosen in the
  // filter menu turns Attention off the same way.
  const changeFilterFromMenu = (next: FilterState) => {
    if (next.statuses.size > 0) setAttentionOnly(false);
    setFilterState(next);
  };

  const sidebarSelections = useSidebarSelections({
    commentItems: () => props.commentItems ?? [],
    groups: () => props.groups ?? [],
    filter: filterState,
    searchQuery,
    flaggedOnly,
    attentionOnly,
    order,
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkAssignableGroups = createMemo(() =>
    assignableGroupsFor({ groupId: null }, props.groups),
  );

  // Prune checked selections that become ticketed (e.g. ticket assigned externally)
  createEffect(() => {
    const current = selectedIds();
    if (current.size === 0) return;
    const pruned = new Set(
      [...current].filter((id) => {
        const item = props.commentItems.find((i) => i.id === id);
        return (
          item && !isSelectionLocked({ groupId: item.groupId }, props.groups)
        );
      }),
    );
    if (pruned.size !== current.size) setSelectedIds(pruned);
  });

  const [activeDetailGroupId, setActiveDetailGroupId] = createSignal<
    string | null
  >(null);

  // Local dialog state for the GROUP "Create JIRA Ticket" flow. Mirrors the
  // mount-on-demand pattern of `looseTicketDialog` (controlled by core) — both
  // dialogs are mounted via <Show> only when their state is set, so Kobalte's
  // click-outside handler is installed *after* the click that opened it has
  // finished propagating. Eliminates the same-tick close that was breaking the
  // group flow before.
  const [groupTicketDialog, setGroupTicketDialog] = createSignal<{
    group: SelectionGroupWithJira;
    items: CommentItem[];
  } | null>(null);

  const activeGroup = createMemo(
    () => props.groups.find((g) => g.id === activeDetailGroupId()) ?? null,
  );

  // Guard: if the active group is deleted while the detail view is open, return to list
  createEffect(() => {
    const id = activeDetailGroupId();
    if (id !== null && !props.groups.find((g) => g.id === id)) {
      setActiveDetailGroupId(null);
    }
  });

  // Notify parent when active detail group changes (for canvas glow)
  createEffect(() => {
    props.onActiveDetailGroupChange(activeDetailGroupId());
  });

  // Focus management: list → detail
  createEffect(() => {
    if (activeDetailGroupId() !== null) {
      queueMicrotask(() => detailViewRef?.focus());
    }
  });

  // Focus management: detail → list (back navigation)
  createEffect(() => {
    if (activeDetailGroupId() === null && lastDetailGroupId) {
      const groupId = lastDetailGroupId;
      // The tree is mounted again, so find the group's button anew.
      queueMicrotask(() => {
        containerRef
          ?.querySelector<HTMLElement>(
            `[data-react-grab-group-ticket-summary="${CSS.escape(groupId)}"] button`,
          )
          ?.focus();
      });
    }
  });

  // NOTE: userFacingGroups is read via untrack() to prevent a reactive loop:
  // filter effect → setGroupsRevealed → persistGroups → props.groups changes
  // → userFacingGroups changes → filter effect re-runs (if tracking it) → LOOP
  // Only filterState() is tracked — this effect re-runs only when the user changes filters.
  createEffect(() => {
    const filter = filterState();
    const allGroups = untrack(() => userFacingGroups());
    const allIds = allGroups.map((g) => g.id);
    if (!isFilterActive(filter)) {
      props.onFilterVisibilityChange?.(new Set(allIds), allIds);
      return;
    }
    const filtered = applyFilters(allGroups, filter);
    const visibleIds = new Set(filtered.map((g) => g.id));
    props.onFilterVisibilityChange?.(visibleIds, allIds);
  });

  return (
    <div
      ref={(el) => {
        containerRef = el;
      }}
      data-react-grab-sidebar
      data-react-grab-ignore-events
      tabIndex={-1}
      class="fixed top-0 left-0 w-[380px] h-screen flex flex-col bg-card text-card-foreground outline-none animate-slide-in-left"
      style={{
        "z-index": "var(--z-sidebar)",
        "pointer-events": "auto",
        isolation: "isolate",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="React Grab Dashboard"
    >
      <SidebarHeader
        syncStatus={props.syncStatus}
        onClose={props.onClose}
        onInfoClick={() => setShowLegend(true)}
      />

      <Show when={showLegend()}>
        <StatusLegend onClose={() => setShowLegend(false)} />
      </Show>

      <Show when={props.syncStatus === "error"}>
        <SyncOfflineBanner onRetry={props.onRetrySync} />
      </Show>

      {/* Phase 2 navigation: list view vs detail view */}
      <Show
        when={activeDetailGroupId() !== null && activeGroup() !== null}
        fallback={
          <>
            <StatusFilter
              options={sidebarSelections.statusOptions()}
              filter={filterState()}
              onFilterChange={setFilterState}
              attentionCount={sidebarSelections.attentionCount()}
              attentionOnly={attentionOnly()}
              onAttentionOnlyChange={setAttentionOnly}
            />
            <div class="min-h-0 flex-1 flex flex-col">
              <div
                data-react-grab-sidebar-search
                class="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-foreground/[0.01]"
              >
                <input
                  type="text"
                  placeholder="Search selections..."
                  class="flex-1 bg-foreground/[0.03] border border-border rounded-lg px-3 py-1.5 text-caption text-foreground placeholder:text-muted-foreground outline-none focus:border-selection transition-colors"
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  data-react-grab-ignore-events
                />
                <FilterMenu
                  filter={filterState()}
                  capturers={getDistinctCapturers(props.commentItems)}
                  assignees={getDistinctAssignees(userFacingGroups())}
                  reporters={getDistinctReporters(userFacingGroups())}
                  labels={getDistinctLabels(userFacingGroups())}
                  onFilterChange={changeFilterFromMenu}
                />
                <IconButton
                  label="Flagged only"
                  variant="outline"
                  size="icon-md"
                  class={cn(
                    "shrink-0",
                    flaggedOnly() &&
                      "border-flag bg-flag/8 hover:bg-flag/8 aria-pressed:bg-flag/8",
                  )}
                  aria-pressed={flaggedOnly()}
                  onClick={() => setFlaggedOnly((prev) => !prev)}
                >
                  <IconFlag
                    size={14}
                    class={
                      flaggedOnly() ? "text-flag" : "text-muted-foreground"
                    }
                  />
                </IconButton>
              </div>
              <FilterChips
                filter={filterState()}
                onFilterChange={changeFilterFromMenu}
              />
              <ListViewControls
                grouping={grouping()}
                onGroupingChange={setGrouping}
                order={order()}
                onOrderChange={setOrder}
              />

              <Show
                when={
                  userFacingGroups().length > 0 || props.commentItems.length > 0
                }
                fallback={
                  <EmptyState
                    message="No selections yet."
                    submessage="Select elements on the page to get started."
                  />
                }
              >
                <SelectionTreePanel
                  tree={sidebarSelections.tree()}
                  statusSections={sidebarSelections.statusSections()}
                  grouping={grouping()}
                  statusOf={sidebarSelections.statusOf}
                  archived={sidebarSelections.archived()}
                  commentItems={props.commentItems ?? []}
                  archive={props.archive}
                  groups={props.groups ?? []}
                  selectedIds={selectedIds()}
                  onToggleSelect={toggleSelect}
                  commentEditorToolbarVisible={
                    props.commentEditorToolbarVisible
                  }
                  onCreateTicket={props.onCreateTicketForLooseItem}
                  onMoveItem={props.onMoveItem}
                  onRemoveItem={props.onRemoveItem}
                  canRemoveItem={props.canRemoveItem}
                  onAddGroup={props.onAddGroup}
                  focusRequest={props.focusRequest}
                  onRenameGroup={props.onRenameGroup}
                  onDeleteGroup={props.onDeleteGroup}
                  onToggleGroupRevealed={props.onToggleGroupRevealed}
                  onCopyGroup={props.onCopyGroup}
                  onOpenGroupDetail={(groupId) => {
                    lastDetailGroupId = groupId;
                    setActiveDetailGroupId(groupId);
                  }}
                />
              </Show>
            </div>
          </>
        }
      >
        <GroupDetailView
          ref={(el: HTMLDivElement) => {
            detailViewRef = el;
          }}
          group={activeGroup()!}
          commentItems={props.commentItems}
          onBack={() => setActiveDetailGroupId(null)}
          onCreateTicket={(group, items) =>
            setGroupTicketDialog({ group, items })
          }
          onRemoveItem={props.onRemoveItem}
          canRemoveItem={props.canRemoveItem}
          onArchive={
            props.archive
              ? (groupId) => {
                  // The group leaves the board, so its detail view closes.
                  setActiveDetailGroupId(null);
                  props.archive?.archiveGroup(groupId);
                }
              : undefined
          }
        />
      </Show>

      <Show when={groupTicketDialog()}>
        {(state) => (
          <JiraCreateDialog
            groupId={state().group.id}
            group={state().group}
            commentItems={state().items}
            onTicketCreated={(groupId, ticketId, ticketUrl) => {
              // The dialog stays open to confirm the ticket; it closes via
              // its own Done button, which calls onClose.
              props.onTicketCreated?.(groupId, ticketId, ticketUrl);
            }}
            onClose={() => setGroupTicketDialog(null)}
          />
        )}
      </Show>

      <Show when={selectedIds().size > 0}>
        <BulkActionBar
          selectedCount={selectedIds().size}
          onClearSelection={() => setSelectedIds(new Set<string>())}
          actions={
            <BulkGroupPicker
              groups={bulkAssignableGroups()}
              onSelect={(groupId) => {
                props.onMoveItems?.(selectedIds(), groupId);
                setSelectedIds(new Set<string>());
              }}
              onAddGroup={props.onAddGroup}
            />
          }
        />
      </Show>

      <ImageLightbox
        open={lightbox.state().open}
        src={lightbox.state().src}
        caption={lightbox.state().caption}
        onClose={lightbox.close}
      />
    </div>
  );
};
