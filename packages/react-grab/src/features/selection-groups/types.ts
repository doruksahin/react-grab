import type { Accessor, Setter } from "solid-js";
import type { ServerSelectionGroup } from "../../generated/types.js";
import type { CommentItem } from "../../types.js";

/**
 * Application-level group type. Extends the server type with UI-only fields.
 * Extends the server type with UI-layer fields that are persisted locally
 * (localStorage / D1 via the storage adapter) but not part of the OpenAPI spec.
 */
export interface SelectionGroup extends ServerSelectionGroup {
  /** True when JIRA polling confirms statusCategory === "done". Persisted so it
   *  survives page refresh without waiting for the next poll cycle. */
  jiraResolved?: boolean;
}

/**
 * Dependencies injected from core/index.tsx into the selection groups module.
 */
export interface SelectionGroupsDeps {
  commentItems: Accessor<CommentItem[]>;
  setCommentItems: Setter<CommentItem[]>;
  persistCommentItems: (items: CommentItem[]) => CommentItem[];
}

/**
 * Public API returned by createSelectionGroups.
 */
export interface SelectionGroupsAPI {
  groups: Accessor<SelectionGroup[]>;
  setGroups: Setter<SelectionGroup[]>;
  persistGroups: (groups: SelectionGroup[]) => SelectionGroup[];
  activeGroupId: Accessor<string | null>;
  setActiveGroupId: Setter<string | null>;
  handleAddGroup: (name: string) => void;
  handleRenameGroup: (groupId: string, name: string) => void;
  handleDeleteGroup: (groupId: string) => void;
  handleMoveItem: (itemId: string, groupId: string | null) => void;
}

/**
 * All group-related props passed through the renderer chain.
 * ReactGrabRendererProps extends this. Component props Pick<> their subset.
 */
export interface SelectionGroupsViewProps {
  groups?: SelectionGroup[];
  activeGroupId?: string | null;
  onActiveGroupChange?: (groupId: string | null) => void;
  onAddGroup?: (name: string) => void;
  onRenameGroup?: (groupId: string, name: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onToggleGroupRevealed?: (groupId: string) => void;
  onMoveItem?: (itemId: string, groupId: string | null) => void;
  onJiraResolved?: (groupId: string) => void;
}
