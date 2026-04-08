// packages/react-grab/src/features/sidebar/jira-defaults.ts
import type { SelectionGroupWithJira } from "./jira-types.js";
import type { CommentItem } from "../../types.js";
import { isSynthetic } from "../selection-groups/business/synthetic-group.js";

const APP_NAME = "ui-ticket-manager";

/**
 * Generates the default JIRA ticket summary from the group name.
 */
export function defaultSummary(group: SelectionGroupWithJira): string {
  return group.name;
}

/**
 * Generates the default JIRA ticket description as a markdown string.
 * The sync-server converts this to ADF before calling JIRA (ADR-0004).
 * The user can edit this in the dialog before submitting.
 */
export function defaultDescription(
  group: SelectionGroupWithJira,
  items: CommentItem[],
): string {
  const lines: string[] = [
    ...(isSynthetic(group) ? [] : [`Group: **${group.name}**`, ""]),
    "## Selections",
    ...items.map(
      (item, i) =>
        `${i + 1}. **${item.componentName ?? item.elementName}** \`<${item.tagName}>\`` +
        (item.commentText ? ` — ${item.commentText}` : ""),
    ),
    "",
    `_Created by ${APP_NAME}_`,
  ];
  return lines.join("\n");
}
