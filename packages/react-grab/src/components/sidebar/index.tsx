// packages/react-grab/src/components/sidebar/index.tsx
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  Show,
} from "solid-js";
import createFocusTrap from "solid-focus-trap";
import type { CommentItem } from "../../types.js";
import type { SyncStatus } from "../../features/sync/types.js";
import { Z_INDEX_LABEL } from "../../constants.js";
import { SidebarHeader } from "./sidebar-header.js";
import { EmptyState } from "./empty-state.js";
import { StatsBar } from "./stats-bar.js";
import { FilterTabs, type FilterStatus } from "./filter-tabs.js";
import { GroupList } from "./group-list.js";
import { GroupDetailView } from "./group-detail-view.js";
import { groupComments } from "../../features/selection-groups/business/group-operations.js";
import {
  deriveEntryStatus,
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

  // Local groups signal: allows JIRA fields (jiraResolved, jiraStatus, jiraUrl)
  // to be mutated client-side without a server round-trip.
  const [groups, setGroups] = createSignal<SelectionGroupWithJira[]>(
    props.groups,
  );

  // Keep local signal in sync when parent updates (new groups from sync).
  // Preserve local JIRA fields when merging.
  createEffect(() => {
    setGroups((prev) =>
      props.groups.map((pg) => {
        const local = prev.find((lg) => lg.id === pg.id);
        if (!local) return pg;
        return {
          ...pg,
          jiraResolved: local.jiraResolved,
          jiraStatus: local.jiraStatus,
          jiraStatusCategory: local.jiraStatusCategory,
          jiraUrl: local.jiraUrl,
          jiraAssignee: local.jiraAssignee,
          jiraReporter: local.jiraReporter,
        };
      }),
    );
  });

  const [activeFilter, setActiveFilter] = createSignal<FilterStatus>("all");
  const [activeDetailGroupId, setActiveDetailGroupId] = createSignal<
    string | null
  >(null);

  const activeGroup = createMemo(
    () => groups().find((g) => g.id === activeDetailGroupId()) ?? null,
  );

  // Guard: if the active group is deleted while the detail view is open, return to list
  createEffect(() => {
    const id = activeDetailGroupId();
    if (id !== null && !groups().find((g) => g.id === id)) {
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
    groupComments(groups(), props.commentItems),
  );

  const filteredGroups = createMemo(() => {
    const filter = activeFilter();
    const items = groupedItems();
    if (filter === "all") return items;
    return items.filter(
      (entry: GroupedEntry) => deriveEntryStatus(entry) === filter,
    );
  });

  function handleTicketCreated(
    groupId: string,
    ticketId: string,
    ticketUrl: string,
  ) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, jiraTicketId: ticketId, jiraUrl: ticketUrl }
          : g,
      ),
    );
  }

  function handleStatusUpdate(
    groupId: string,
    status: { status: string; statusCategory: string; assignee: string | null; reporter: string | null },
  ) {
    const resolved = status.statusCategory.toLowerCase() === "done";
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              jiraStatus: status.status,
              jiraStatusCategory: status.statusCategory,
              jiraAssignee: status.assignee,
              jiraReporter: status.reporter,
              jiraResolved: resolved,
            }
          : g,
      ),
    );
    if (resolved) {
      props.onJiraResolved?.(groupId);
    }
  }

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
                  when={groups().length > 0}
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
                        message={`No ${activeFilter()} groups.`}
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
              onTicketCreated={handleTicketCreated}
              onStatusUpdate={handleStatusUpdate}
            />
          </Show>
        </Show>
      </div>
    </ShadowRootContext.Provider>
  );
};
