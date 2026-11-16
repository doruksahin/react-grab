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
import { SyncOfflineBanner } from "./sync-offline-banner.js";
import { FilterMenu } from "./filter-menu.js";
import { FilterChips } from "./filter-chips.js";
import {
  type FilterState,
  EMPTY_FILTER,
  isFilterActive,
  applyFilters,
  getDistinctAssignees,
  getDistinctReporters,
  getDistinctLabels,
} from "../../features/sidebar/filter-state.js";
import { GroupList } from "./group-list.js";
import { GroupDetailView } from "./group-detail-view.js";
import { StatusLegend } from "./status-legend.js";
import { groupComments } from "../../features/selection-groups/business/group-operations.js";
import { type GroupedEntry } from "../../features/sidebar/index.js";
import type { SelectionGroupWithJira } from "../../features/selection-groups/types.js";
import { presentedGroups } from "../../features/selection-groups/business/membership.js";
import { JiraCreateDialog } from "./jira-create-dialog.jsx";
import { TabBar } from "./tab-bar.js";
import { Tabs, TabsContent } from "../ui/tabs.js";
import { SelectionListTab } from "./selection-list-tab.js";
import { BulkActionBar } from "./bulk-action-bar.js";
import { BulkGroupPicker } from "./bulk-group-picker.js";
import { isSelectionLocked } from "../../features/selection-groups/business/ticket-lock.js";
import { assignableGroupsFor } from "../../features/selection-groups/business/membership-policy.js";
import { ImageLightbox } from "../ui/image-lightbox.js";
import { useImageLightbox } from "../../features/image-lightbox/index.js";
import { IconFlag } from "../icons/icon-flag.js";
import { IconButton } from "../ui/icon-button.js";

export interface SidebarProps {
  groups: SelectionGroupWithJira[];
  commentItems: CommentItem[];
  syncStatus: SyncStatus;
  onRetrySync?: () => Promise<void>;
  /** Host of the Jira site (GET /jira/site), when the sync server reports it. */
  jiraSiteHost?: string;
  jiraProjectKey?: string;
  onClose: () => void;
  /** Open on this selection, in the Selections tab where its Jira thread
   *  is (a label's "Open thread"); a new object for every request. */
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
  onMoveItem?: (itemId: string, groupId: string | null) => void;
  onMoveItems?: (itemIds: Set<string>, groupId: string) => void;
  onAddGroup?: (name: string) => void;
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
  let lastFocusedCard: HTMLElement | undefined;
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
    // Opened on a selection: the Selections tab moves focus to its card.
    onInitialFocus: (event: Event) => {
      if (untrack(() => props.focusRequest)) event.preventDefault();
    },
    // The lightbox is a modal dialog with its own focus trap.
    enabled: () => !lightbox.state().open,
  });

  // Synthetic groups are invisible in user-facing surfaces (GroupList,
  // filter chips, stats bar, empty-state guard). Loose selections appear
  // in the Selections tab via SelectionListTab + isPresentedAsLoose.
  const userFacingGroups = createMemo(() =>
    presentedGroups(props.groups, props.commentItems),
  );

  const [activeTab, setActiveTab] = createSignal<"groups" | "selections">(
    "groups",
  );
  // A focus request shows the Selections tab; the tab scrolls to the card.
  createEffect(
    on(
      () => props.focusRequest,
      (request) => {
        if (!request) return;
        setActiveDetailGroupId(null);
        setActiveTab("selections");
      },
    ),
  );
  const handleTabChange = (value: string) => {
    if (value === "groups" || value === "selections") setActiveTab(value);
  };
  const [showLegend, setShowLegend] = createSignal(false);
  const [filterState, setFilterState] = createSignal<FilterState>(EMPTY_FILTER);
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = createSignal("");
  const [flaggedOnly, setFlaggedOnly] = createSignal(false);

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
    if (activeDetailGroupId() === null && lastFocusedCard) {
      queueMicrotask(() => {
        if (lastFocusedCard?.isConnected) {
          lastFocusedCard.focus();
        }
      });
    }
  });

  const groupedItems = createMemo(() =>
    groupComments(userFacingGroups(), props.commentItems),
  );

  const filteredGroups = createMemo(() => {
    const filter = filterState();
    if (!isFilterActive(filter)) return groupedItems();
    const filtered = applyFilters(userFacingGroups(), filter);
    return groupedItems().filter((entry: GroupedEntry) =>
      filtered.some((g) => g.id === entry.group.id),
    );
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
              groups={userFacingGroups()}
              filter={filterState()}
              onFilterChange={setFilterState}
            />
            <Tabs
              value={activeTab()}
              onChange={handleTabChange}
              class="min-h-0 flex-1"
            >
              <TabBar
                groupsCount={userFacingGroups().length}
                selectionsCount={(props.commentItems ?? []).length}
              />

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
                  assignees={getDistinctAssignees(userFacingGroups())}
                  reporters={getDistinctReporters(userFacingGroups())}
                  labels={getDistinctLabels(userFacingGroups())}
                  onFilterChange={setFilterState}
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
                onFilterChange={setFilterState}
              />

              <TabsContent value="groups">
                <Show
                  when={
                    userFacingGroups().length > 0 ||
                    props.commentItems.length > 0
                  }
                  fallback={
                    <EmptyState
                      message="No selections yet."
                      submessage="Select elements on the page to get started."
                    />
                  }
                >
                  <div class="flex-1 overflow-y-auto">
                    <Show when={filteredGroups().length > 0}>
                      <GroupList
                        groupedItems={filteredGroups()}
                        onGroupClick={(id: string, cardEl: HTMLElement) => {
                          lastFocusedCard = cardEl;
                          setActiveDetailGroupId(id);
                        }}
                      />
                    </Show>

                    {/* "No groups match" only makes sense when groups
                          actually exist but are fully filtered out. */}
                    <Show
                      when={
                        userFacingGroups().length > 0 &&
                        filteredGroups().length === 0
                      }
                    >
                      <EmptyState
                        message={"No groups match the active filters."}
                      />
                    </Show>
                  </div>
                </Show>
              </TabsContent>

              <TabsContent value="selections">
                <SelectionListTab
                  commentItems={props.commentItems ?? []}
                  groups={props.groups ?? []}
                  filter={filterState()}
                  selectedIds={selectedIds()}
                  onToggleSelect={toggleSelect}
                  searchQuery={searchQuery()}
                  flaggedOnly={flaggedOnly()}
                  commentEditorToolbarVisible={
                    props.commentEditorToolbarVisible
                  }
                  onCreateTicket={props.onCreateTicketForLooseItem}
                  onMoveItem={props.onMoveItem}
                  onAddGroup={props.onAddGroup}
                  focusRequest={props.focusRequest}
                />
              </TabsContent>
            </Tabs>
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
        />
      </Show>

      <Show when={groupTicketDialog()}>
        {(state) => (
          <JiraCreateDialog
            groupId={state().group.id}
            group={state().group}
            commentItems={state().items}
            jiraProjectKey={props.jiraProjectKey ?? ""}
            jiraSiteHost={props.jiraSiteHost}
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
