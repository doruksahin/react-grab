import { type JSX, Show } from "solid-js";
import { Key } from "@solid-primitives/keyed";
import type { CommentItem } from "../../types.js";
import type { SelectionGroup } from "../../features/selection-groups/types.js";
import type { SelectionTree } from "../../features/selection-groups/business/selection-tree.js";
import { canDeleteGroup } from "../../features/selection-groups/business/membership-policy.js";
import { UngroupedSection } from "./ungrouped-section.jsx";
import { GroupCollapsible } from "./group-collapsible.jsx";

export interface SelectionTreeViewProps<Group extends SelectionGroup> {
  tree: SelectionTree<Group>;
  renderItem: (item: CommentItem) => JSX.Element;
  onRenameGroup?: (groupId: string, name: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onToggleGroupRevealed?: (groupId: string) => void;
  onCopyGroup?: (groupId: string) => void;
  /** Extra header content per group (the sidebar's ticket status). */
  groupHeaderExtra?: (group: Group) => JSX.Element;
  /** A section holding this selection opens (a focus request). */
  revealItemId?: string | null;
}

/**
 * The selection tree as both the comments menu and the sidebar draw it
 * (ADR-0028): Ungrouped first, then each group. Each surface supplies only
 * how a selection row looks. Sections are keyed by group id, so a change
 * to the data keeps each section's open state and its cards' own state.
 */
export const SelectionTreeView = <Group extends SelectionGroup>(
  props: SelectionTreeViewProps<Group>,
): JSX.Element => (
  <>
    <Show when={props.tree.ungrouped.length > 0}>
      <UngroupedSection
        items={props.tree.ungrouped}
        isFirst={true}
        renderItem={props.renderItem}
        revealItemId={props.revealItemId}
      />
    </Show>
    <Key each={props.tree.groups} by={(section) => section.group.id}>
      {(section, index) => (
        <GroupCollapsible
          group={section().group}
          items={section().items}
          isFirst={index() === 0 && props.tree.ungrouped.length === 0}
          onRename={(groupId, name) => props.onRenameGroup?.(groupId, name)}
          onDelete={
            canDeleteGroup(section().group)
              ? (groupId) => props.onDeleteGroup?.(groupId)
              : undefined
          }
          onToggleRevealed={(groupId) => props.onToggleGroupRevealed?.(groupId)}
          onCopy={(groupId) => props.onCopyGroup?.(groupId)}
          headerExtra={props.groupHeaderExtra?.(section().group)}
          renderItem={props.renderItem}
          revealItemId={props.revealItemId}
        />
      )}
    </Key>
  </>
);
