import type { Accessor, Setter } from "solid-js";
import type { ServerSelectionGroup } from "../../generated/types.js";
import type { CommentItem } from "../../types.js";

export const DEFAULT_GROUP_ID = "default" as const;
export const DEFAULT_GROUP_NAME = "Default" as const;

/**
 * Application-level group type. Extends the server type with UI-only fields.
 * Currently empty — placeholder for future fields like local UI state.
 * Do not add server-persisted fields here; update the OpenAPI spec instead.
 */
export interface SelectionGroup extends ServerSelectionGroup {}

export const createDefaultGroup = (): SelectionGroup => ({
  id: DEFAULT_GROUP_ID,
  name: DEFAULT_GROUP_NAME,
  createdAt: 0,
  revealed: false,
});

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
  activeGroupId: Accessor<string>;
  setActiveGroupId: Setter<string>;
  handleAddGroup: (name: string) => void;
  handleRenameGroup: (groupId: string, name: string) => void;
  handleDeleteGroup: (groupId: string) => void;
  handleMoveItem: (itemId: string, groupId: string) => void;
}

/**
 * All group-related props passed through the renderer chain.
 * ReactGrabRendererProps extends this. Component props Pick<> their subset.
 */
export interface SelectionGroupsViewProps {
  groups?: SelectionGroup[];
  activeGroupId?: string;
  onActiveGroupChange?: (groupId: string) => void;
  onAddGroup?: (name: string) => void;
  onRenameGroup?: (groupId: string, name: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onToggleGroupRevealed?: (groupId: string) => void;
  onMoveItem?: (itemId: string, groupId: string) => void;
}
