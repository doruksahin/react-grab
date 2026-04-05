// packages/react-grab/src/components/sidebar/index.tsx
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  Show,
} from "solid-js";
import type { SelectionGroup } from "../../features/selection-groups/types";
import type { CommentItem } from "../../types";
import type { SyncStatus } from "../../features/sync/types";
import { Z_INDEX_SIDEBAR } from "../../constants";
import { SidebarHeader } from "./sidebar-header";
import { EmptyState } from "./empty-state";
import { StatsBar } from "./stats-bar";
import { FilterTabs, type FilterStatus } from "./filter-tabs";
import { GroupList } from "./group-list";
import { GroupDetailView } from "./group-detail-view";
import { groupComments } from "../../features/selection-groups/business/group-operations";
import { deriveStatus, type GroupedEntry } from "../../features/sidebar";

export interface SidebarProps {
  groups: SelectionGroup[];
  commentItems: CommentItem[];
  syncStatus: SyncStatus;
  syncServerUrl?: string;
  syncWorkspace?: string;
  onClose: () => void;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  // Instance-scoped (not module-scoped) — safe for multiple Sidebar instances
  let lastFocusedCard: HTMLElement | undefined;
  let detailViewRef: HTMLDivElement | undefined;

  const [activeFilter, setActiveFilter] = createSignal<FilterStatus>("all");
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
        // If card was removed from DOM, focus falls to the sidebar container naturally
      });
    }
  });

  const groupedItems = createMemo(() =>
    groupComments(props.groups, props.commentItems),
  );

  const filteredGroups = createMemo(() => {
    const filter = activeFilter();
    const items = groupedItems();
    if (filter === "all") return items;
    return items.filter((entry: GroupedEntry) => deriveStatus(entry) === filter);
  });

  return (
    <div
      data-react-grab-ignore-events
      class="fixed top-0 left-0 w-[380px] h-screen flex flex-col bg-[#1a1a1a] text-[#e5e5e5] animate-slide-in-left"
      style={{ "z-index": String(Z_INDEX_SIDEBAR), "pointer-events": "auto" }}
      role="dialog"
      aria-modal="false"
      aria-label="React Grab Dashboard"
    >
      <SidebarHeader syncStatus={props.syncStatus} onClose={props.onClose} />

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
              <FilterTabs
                activeFilter={activeFilter()}
                onFilterChange={setActiveFilter}
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
                    <EmptyState message={`No ${activeFilter()} groups.`} />
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
            ref={(el: HTMLDivElement) => { detailViewRef = el; }}
            group={activeGroup()!}
            commentItems={props.commentItems}
            syncServerUrl={props.syncServerUrl}
            syncWorkspace={props.syncWorkspace}
            onBack={() => setActiveDetailGroupId(null)}
          />
        </Show>
      </Show>
    </div>
  );
};
