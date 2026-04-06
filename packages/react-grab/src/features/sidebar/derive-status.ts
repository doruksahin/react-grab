// packages/react-grab/src/features/sidebar/derive-status.ts
import type { SelectionGroup } from "../selection-groups/types.js";
import type { CommentItem } from "../../types.js";

export interface GroupedEntry {
  group: SelectionGroup;
  items: CommentItem[];
}
