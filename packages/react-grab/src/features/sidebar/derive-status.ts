// packages/react-grab/src/features/sidebar/derive-status.ts
import type { SelectionGroupWithJira } from "./jira-types.js";
import type { CommentItem } from "../../types.js";

export interface GroupedEntry {
  group: SelectionGroupWithJira;
  items: CommentItem[];
}
