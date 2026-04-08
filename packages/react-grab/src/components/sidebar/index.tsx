// packages/react-grab/src/components/sidebar/index.tsx
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  Show,
  untrack,
} from "solid-js";
import createFocusTrap from "solid-focus-trap";
import type { CommentItem, TicketCreatedCallback } from "../../types.js";
import type { SyncStatus } from "../../features/sync/types.js";
import { SidebarHeader } from "./sidebar-header.js";
import { EmptyState } from "./empty-state.js";
import { StatsBar } from "./stats-bar.js";
import { FilterBar } from "./filter-bar.js";
import { FilterChips } from "./filter-chips.js";
import { type FilterState, EMPTY_FILTER, isFilterActive, applyFilters, getDistinctAssignees, getDistinctReporters, getDistinctLabels } from "../../features/sidebar/filter-state.js";
import { GroupList } from "./group-list.js";
import { GroupDetailView } from "./group-detail-view.js";
import { StatusLegend } from "./status-legend.js";
import { groupComments } from "../../features/selection-groups/business/group-operations.js";
import {
  type GroupedEntry,
} from "../../features/sidebar/index.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import { isSynthetic } from "../../features/selection-groups/business/synthetic-group.js";
import { LooseSelectionList } from "./loose-selection-list.jsx";
import { JiraCreateDialog } from "./jira-create-dialog.jsx";

export interface SidebarProps {
  groups: SelectionGroupWithJira[];
  commentItems: CommentItem[];
  syncStatus: SyncStatus;
  syncServerUrl?: string;
  syncWorkspace?: string;
  jiraProjectKey?: string;
  onClose: () => void;
  onActiveDetailGroupChange: (groupId: string | null) => void;
  onJiraResolved?: (groupId: string) => void;
  onTicketCreated?: TicketCreatedCallback;
  onFilterVisibilityChange?: (visibleIds: Set<string>, allGroupIds: string[]) => void;
  onCreateTicketForLooseItem?: (item: CommentItem) => void;
  onRemoveItem?: (itemId: string) => void;
  /** When set, opens the Jira create dialog for this loose item + its synthetic group. */
  looseTicketDialog?: { item: CommentItem; syntheticGroup: SelectionGroupWithJira } | null;
  onLooseTicketDialogClose?: () => void;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  // Instance-scoped (not module-scoped) — safe for multiple Sidebar instances
  let lastFocusedCard: HTMLElement | undefined;
  let detailViewRef: HTMLDivElement | undefined;
  let containerRef: HTMLDivElement | undefined;
  let listScrollRef: HTMLDivElement | undefined;

  // Trap focus inside the sidebar for the duration it is mounted.
  // solid-focus-trap restores focus to the previously focused element on cleanup.
  createFocusTrap({ element: () => containerRef ?? null, enabled: () => true });

  // Synthetic groups are invisible in every user-facing surface (GroupList,
  // filter chips, stats bar, empty-state guard). The full props.groups list
  // is preserved so LooseSelectionList can look up synthetic groups by id.
  const userFacingGroups = createMemo(() =>
    props.groups.filter((g) => !isSynthetic(g)),
  );

  const [showLegend, setShowLegend] = createSignal(false);
  const [filterState, setFilterState] = createSignal<FilterState>(EMPTY_FILTER);
  const [activeDetailGroupId, setActiveDetailGroupId] = createSignal<
    string | null
  >(null);

  // Local dialog state for the GROUP "Create JIRA Ticket" flow. Mirrors the
  // mount-on-demand pattern of `looseTicketDialog` (controlled by core) — both
  // dialogs are mounted via <Show> only when their state is set, so Kobalte's
  // click-outside handler is installed *after* the click that opened it has
  // finished propagating. Eliminates the same-tick close that was breaking the
  // group flow before.
  const [groupTicketDialog, setGroupTicketDialog] = createSignal<
    { group: SelectionGroupWithJira; items: CommentItem[] } | null
  >(null);

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
      ref={(el) => { containerRef = el; }}
      data-react-grab-sidebar
        data-react-grab-ignore-events
        class="fixed top-0 left-0 w-[380px] h-screen flex flex-col bg-card text-card-foreground animate-slide-in-left"
        style={{ "z-index": "var(--z-sidebar)", "pointer-events": "auto", isolation: "isolate" }}
        role="dialog"
        aria-modal="true"
        aria-label="React Grab Dashboard"
      >
        <SidebarHeader syncStatus={props.syncStatus} onClose={props.onClose} onInfoClick={() => setShowLegend(true)} />

        <Show when={showLegend()}>
          <StatusLegend onClose={() => setShowLegend(false)} />
        </Show>

        {/* Phase 1 sync error state — must remain intact */}
        <Show
          when={props.syncStatus !== "error"}
          fallback={
            <EmptyState
              message="Could not connect to sync server."
              action={{ label: "Retry", onClick: () => {} }}
            />
          }
        >
          {/* Phase 2 navigation: list view vs detail view */}
          <Show
            when={activeDetailGroupId() !== null && activeGroup() !== null}
            fallback={
              <>
                <StatsBar groupedItems={groupedItems()} />
                <FilterBar
                  filter={filterState()}
                  assignees={getDistinctAssignees(userFacingGroups())}
                  reporters={getDistinctReporters(userFacingGroups())}
                  labels={getDistinctLabels(userFacingGroups())}
                  onFilterChange={setFilterState}
                />
                <FilterChips
                  filter={filterState()}
                  onFilterChange={setFilterState}
                />

                <Show
                  when={userFacingGroups().length > 0}
                  fallback={
                    <EmptyState
                      message="No selections yet."
                      submessage="Select elements on the page to get started."
                    />
                  }
                >
                  <div
                    ref={(el) => { listScrollRef = el; }}
                    class="flex-1 overflow-y-auto"
                  >
                    <LooseSelectionList
                      allGroups={props.groups}
                      commentItems={props.commentItems}
                      syncServerUrl={props.syncServerUrl}
                      syncWorkspace={props.syncWorkspace}
                      scrollRoot={() => listScrollRef ?? null}
                      onCreateTicket={(item) => props.onCreateTicketForLooseItem?.(item)}
                      onRemoveItem={props.onRemoveItem}
                    />

                    <Show
                      when={filteredGroups().length > 0}
                      fallback={
                        <EmptyState
                          message={"No groups match the active filters."}
                        />
                      }
                    >
                      <GroupList
                        groupedItems={filteredGroups()}
                        onGroupClick={(id: string, cardEl: HTMLElement) => {
                          lastFocusedCard = cardEl;
                          setActiveDetailGroupId(id);
                        }}
                      />
                    </Show>
                  </div>
                </Show>
              </>
            }
          >
            <GroupDetailView
              ref={(el: HTMLDivElement) => {
                detailViewRef = el;
              }}
              group={activeGroup()!}
              commentItems={props.commentItems}
              syncServerUrl={props.syncServerUrl}
              syncWorkspace={props.syncWorkspace}
              onBack={() => setActiveDetailGroupId(null)}
              onCreateTicket={(group, items) =>
                setGroupTicketDialog({ group, items })
              }
              onRemoveItem={props.onRemoveItem}
            />
          </Show>
        </Show>

        <Show when={groupTicketDialog()}>
          {(state) => (
            <JiraCreateDialog
              workspaceId={props.syncWorkspace ?? ""}
              syncServerUrl={props.syncServerUrl}
              groupId={state().group.id}
              group={state().group}
              commentItems={state().items}
              jiraProjectKey={props.jiraProjectKey ?? ""}
              onTicketCreated={(groupId, ticketId, ticketUrl) => {
                props.onTicketCreated?.(groupId, ticketId, ticketUrl);
                setGroupTicketDialog(null);
              }}
              onClose={() => setGroupTicketDialog(null)}
            />
          )}
        </Show>

        <Show when={props.looseTicketDialog}>
          {(state) => (
            <JiraCreateDialog
              workspaceId={props.syncWorkspace ?? ""}
              syncServerUrl={props.syncServerUrl}
              groupId={state().syntheticGroup.id}
              group={state().syntheticGroup}
              commentItems={[state().item]}
              jiraProjectKey={props.jiraProjectKey ?? ""}
              onTicketCreated={(groupId, ticketId, ticketUrl) => {
                props.onTicketCreated?.(groupId, ticketId, ticketUrl);
                props.onLooseTicketDialogClose?.();
              }}
              onClose={() => props.onLooseTicketDialogClose?.()}
            />
          )}
        </Show>
    </div>
  );
};
