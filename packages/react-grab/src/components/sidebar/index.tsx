import { type Component, createMemo, createSignal, Show } from "solid-js";
import type { SelectionGroup } from "../../features/selection-groups/types";
import type { CommentItem } from "../../types";
import type { SyncStatus } from "../../features/sync/types";
import { Z_INDEX_SIDEBAR } from "../../constants";
import { SidebarHeader } from "./sidebar-header";
import { EmptyState } from "./empty-state";
import { StatsBar } from "./stats-bar";
import { FilterTabs, type FilterStatus } from "./filter-tabs";
import { GroupList } from "./group-list";
import { groupComments } from "../../features/selection-groups/business/group-operations";
import { deriveStatus } from "../../features/sidebar";

export interface SidebarProps {
  groups: SelectionGroup[];
  commentItems: CommentItem[];
  syncStatus: SyncStatus;
  onClose: () => void;
  onGroupClick: (groupId: string) => void;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  const [activeFilter, setActiveFilter] = createSignal<FilterStatus>("all");

  const groupedItems = createMemo(() => groupComments(props.groups, props.commentItems));

  const filteredGroups = createMemo(() => {
    const filter = activeFilter();
    const items = groupedItems();
    if (filter === "all") return items;
    return items.filter((entry) => deriveStatus(entry) === filter);
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

      <Show
        when={props.syncStatus !== "error"}
        fallback={
          <EmptyState
            message="Could not connect to sync server."
            action={{ label: "Retry", onClick: () => { /* Phase 2: retry sync */ } }}
          />
        }
      >
        <StatsBar groupedItems={groupedItems()} />
        <FilterTabs activeFilter={activeFilter()} onFilterChange={setActiveFilter} />

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
              onGroupClick={props.onGroupClick}
            />
          </Show>
        </Show>
      </Show>
    </div>
  );
};
