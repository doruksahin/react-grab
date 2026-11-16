import { type Accessor, createMemo } from "solid-js";
import type { CommentItem } from "../../../types.js";
import type { SelectionGroupWithJira } from "../../selection-groups/types.js";
import {
  type SelectionTree,
  selectionTree,
} from "../../selection-groups/business/selection-tree.js";
import { narrowSelectionTree } from "../../selection-groups/business/narrow-selection-tree.js";
import { selectionRowFields } from "../../selection-groups/business/selection-row-fields.js";
import { useSelectionLocation } from "../../selection-location/index.js";
import {
  type FilterState,
  applyFilters,
  isFilterActive,
} from "../filter-state.js";
import {
  type StatusFilterOptions,
  getStatusFilterOptions,
} from "../business/status-filter.js";
import { selectionStatus } from "../business/selection-status.js";
import { needsAttention } from "../business/needs-attention.js";
import {
  type SelectionOrder,
  orderSelections,
} from "../business/order-selections.js";
import {
  type StatusSection,
  sectionsByStatus,
} from "../business/sections-by-status.js";

/** Each input separately, so a memo recomputes only for what it reads. */
export interface SidebarSelectionsInput {
  commentItems: Accessor<CommentItem[]>;
  groups: Accessor<SelectionGroupWithJira[]>;
  filter: Accessor<FilterState>;
  searchQuery: Accessor<string>;
  flaggedOnly: Accessor<boolean>;
  attentionOnly: Accessor<boolean>;
  order: Accessor<SelectionOrder>;
}

export interface SidebarSelections {
  /** The tree by group, narrowed and ordered. */
  tree: Accessor<SelectionTree<SelectionGroupWithJira>>;
  /** The same selections grouped by status. */
  statusSections: Accessor<StatusSection<CommentItem>[]>;
  /** The status chips, counted over the selections before the status filter. */
  statusOptions: Accessor<StatusFilterOptions>;
  attentionCount: Accessor<number>;
  statusOf: (item: CommentItem) => string;
  attentionOf: (item: CommentItem) => boolean;
}

const flatten = <Group extends SelectionGroupWithJira>(
  tree: SelectionTree<Group>,
): CommentItem[] => [
  ...tree.ungrouped,
  ...tree.groups.flatMap((section) => section.items),
];

/**
 * The sidebar's selections as the list shows them: search, the Flagged
 * toggle and the filter menu narrow them; the status and Attention chips
 * count what is left and then narrow it further; the order applies within
 * each section. The chips and the list count the same selections.
 */
export const useSidebarSelections = (
  input: SidebarSelectionsInput,
): SidebarSelections => {
  const locate = useSelectionLocation();

  const groupsById = createMemo(
    () => new Map(input.groups().map((group) => [group.id, group])),
  );
  const statusOf = (item: CommentItem) => selectionStatus(item, groupsById());
  const attentionOf = (item: CommentItem) =>
    needsAttention({
      flagged: item.groupId
        ? groupsById().get(item.groupId)?.jiraFlagged === true
        : false,
      location: locate(item.id).kind,
    });

  // The filter menu picks groups; the status chips pick selections.
  const allowedGroupIds = createMemo(() => {
    const groupFilter = { ...input.filter(), statuses: new Set<string>() };
    if (!isFilterActive(groupFilter)) return null;
    return new Set(
      applyFilters(input.groups(), groupFilter).map((group) => group.id),
    );
  });

  // Search reads what a row shows; Flagged keeps flagged groups' selections.
  const baseFilter = createMemo(() => {
    const query = input.searchQuery().toLowerCase();
    const flaggedOnly = input.flaggedOnly();
    if (!query && !flaggedOnly) return undefined;
    return (item: CommentItem) => {
      if (query) {
        const { title, detail } = selectionRowFields(item);
        if (!`${title} ${detail ?? ""}`.toLowerCase().includes(query)) {
          return false;
        }
      }
      if (flaggedOnly) {
        const group = item.groupId ? groupsById().get(item.groupId) : undefined;
        if (group?.jiraFlagged !== true) return false;
      }
      return true;
    };
  });

  const tree = createMemo(() =>
    selectionTree(input.commentItems(), input.groups()),
  );

  const candidates = createMemo(() =>
    flatten(
      narrowSelectionTree(tree(), {
        itemFilter: baseFilter(),
        allowedGroupIds: allowedGroupIds(),
      }),
    ),
  );

  const statusOptions = createMemo(() =>
    getStatusFilterOptions(candidates().map(statusOf), input.filter()),
  );
  const attentionCount = createMemo(
    () => candidates().filter(attentionOf).length,
  );

  const itemFilter = createMemo(() => {
    const base = baseFilter();
    const statuses = input.filter().statuses;
    const attentionOnly = input.attentionOnly();
    if (!base && statuses.size === 0 && !attentionOnly) return undefined;
    return (item: CommentItem) =>
      (!base || base(item)) &&
      (statuses.size === 0 || statuses.has(statusOf(item))) &&
      (!attentionOnly || attentionOf(item));
  });

  const ordered = (items: CommentItem[]) =>
    orderSelections(items, input.order(), attentionOf);

  const visibleTree = createMemo(() => {
    const narrowed = narrowSelectionTree(tree(), {
      itemFilter: itemFilter(),
      allowedGroupIds: allowedGroupIds(),
    });
    return {
      ungrouped: ordered(narrowed.ungrouped),
      groups: narrowed.groups.map((section) => ({
        ...section,
        items: ordered(section.items),
      })),
    };
  });

  const statusSections = createMemo(() =>
    sectionsByStatus(ordered(flatten(visibleTree())), statusOf),
  );

  return {
    tree: visibleTree,
    statusSections,
    statusOptions,
    attentionCount,
    statusOf,
    attentionOf,
  };
};
