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
import type { CommentItem } from "../../types.js";
import type { SyncStatus } from "../../features/sync/types.js";
import { Z_INDEX_LABEL } from "../../constants.js";
import { SidebarHeader } from "./sidebar-header.js";
import { EmptyState } from "./empty-state.js";
import { StatsBar } from "./stats-bar.js";
import { FilterBar } from "./filter-bar.js";
import { FilterChips } from "./filter-chips.js";
import { type FilterState, EMPTY_FILTER, isFilterActive, applyFilters, getDistinctAssignees, getDistinctReporters } from "../../features/sidebar/filter-state.js";
import { GroupList } from "./group-list.js";
import { GroupDetailView } from "./group-detail-view.js";
import { StatusLegend } from "./status-legend.js";
import { groupComments } from "../../features/selection-groups/business/group-operations.js";
import {
  type GroupedEntry,
} from "../../features/sidebar/index.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import { ShadowRootContext } from "../../features/sidebar/shadow-context.js";

export interface SidebarProps {
  groups: SelectionGroupWithJira[];
  commentItems: CommentItem[];
  syncStatus: SyncStatus;
  syncServerUrl?: string;
  syncWorkspace?: string;
  onClose: () => void;
  onActiveDetailGroupChange: (groupId: string | null) => void;
  onJiraResolved?: (groupId: string) => void;
  onTicketCreated?: (groupId: string, ticketId: string, ticketUrl: string) => void;
  onFilterVisibilityChange?: (visibleIds: Set<string>, allGroupIds: string[]) => void;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  // Instance-scoped (not module-scoped) — safe for multiple Sidebar instances
  let lastFocusedCard: HTMLElement | undefined;
  let detailViewRef: HTMLDivElement | undefined;
  // containerRef is a signal so that shadowRoot() can reactively re-derive
  // after the ref callback fires (refs run after initial render).
  const [containerRef, setContainerRef] = createSignal<
    HTMLDivElement | undefined
  >(undefined);

  // Trap focus inside the sidebar for the duration it is mounted.
  // solid-focus-trap restores focus to the previously focused element on cleanup.
  createFocusTrap({ element: containerRef, enabled: () => true });

  const [showLegend, setShowLegend] = createSignal(false);
  const [filterState, setFilterState] = createSignal<FilterState>(EMPTY_FILTER);
  const [activeDetailGroupId, setActiveDetailGroupId] = createSignal<
    string | null
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
    groupComments(props.groups, props.commentItems),
  );

  const filteredGroups = createMemo(() => {
    const filter = filterState();
    if (!isFilterActive(filter)) return groupedItems();
    const filtered = applyFilters(props.groups, filter);
    return groupedItems().filter((entry: GroupedEntry) =>
      filtered.some((g) => g.id === entry.group.id),
    );
  });

  // NOTE: props.groups is read via untrack() to prevent a reactive loop:
  // filter effect → setGroupsRevealed → persistGroups → props.groups changes
  // → filter effect re-runs (if tracking props.groups) → LOOP
  // Only filterState() is tracked — this effect re-runs only when the user changes filters.
  createEffect(() => {
    const filter = filterState();
    const allGroups = untrack(() => props.groups);
    const allIds = allGroups.map((g) => g.id);
    if (!isFilterActive(filter)) {
      props.onFilterVisibilityChange?.(new Set(allIds), allIds);
      return;
    }
    const filtered = applyFilters(allGroups, filter);
    const visibleIds = new Set(filtered.map((g) => g.id));
    props.onFilterVisibilityChange?.(visibleIds, allIds);
  });

  // Shadow root: resolved reactively from the container element so that
  // the context value is updated after the ref callback fires on mount.
  const shadowRoot = () => {
    const el = containerRef();
    return (el?.getRootNode() as ShadowRoot | Document | null) instanceof
      ShadowRoot
      ? (el!.getRootNode() as ShadowRoot)
      : null;
  };

  return (
    <ShadowRootContext.Provider value={shadowRoot()}>
      <div
        ref={(el) => setContainerRef(el)}
        data-react-grab-ignore-events
        class="fixed top-0 left-0 w-[380px] h-screen flex flex-col bg-[#1a1a1a] text-[#e5e5e5] animate-slide-in-left"
        style={{ "z-index": String(Z_INDEX_LABEL), "pointer-events": "auto" }}
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
                  assignees={getDistinctAssignees(props.groups)}
                  reporters={getDistinctReporters(props.groups)}
                  onFilterChange={setFilterState}
                />
                <FilterChips
                  filter={filterState()}
                  onFilterChange={setFilterState}
                />

                <Show
                  when={props.groups.length > 0}
                  fallback={
                    <EmptyState
                      message="No selections yet."
                      submessage="Select elements on the page to get started."
                    />
                  }
                >
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
              shadowRoot={shadowRoot()}
              onBack={() => setActiveDetailGroupId(null)}
              onTicketCreated={props.onTicketCreated}
            />
          </Show>
        </Show>
      </div>
    </ShadowRootContext.Provider>
  );
};
