// packages/react-grab/src/features/sidebar/jira-defaults.ts
import type { SelectionGroup } from "../selection-groups/types.js";
import type { CommentItem } from "../../types.js";
import { isSynthetic } from "../selection-groups/business/synthetic-group.js";
import { extractFilePath } from "./extract-file-path.js";

const RAW_HTML_MAX_CHARS = 1000;

const SUMMARY_MAX_CHARS = 80;

/** The first line of a text, cut at a word boundary to fit the summary. */
function toSummaryLine(text: string): string {
  const line = (text.split("\n").find((part) => part.trim()) ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (line.length <= SUMMARY_MAX_CHARS) return line;
  const cut = line.slice(0, SUMMARY_MAX_CHARS - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const wordCut =
    lastSpace > SUMMARY_MAX_CHARS / 2 ? cut.slice(0, lastSpace) : cut;
  return `${wordCut.trimEnd()}…`;
}

/**
 * Generates the default JIRA ticket summary. A group the user named keeps
 * its name; a single loose selection (synthetic group) starts from what the
 * user wrote, since its name is only the component name. Falls back to the
 * group name when there is no comment text.
 */
export function defaultSummary(
  group: SelectionGroup,
  items: CommentItem[],
): string {
  if (!isSynthetic(group)) return group.name;
  const commentText = items.find((item) =>
    item.commentText?.trim(),
  )?.commentText;
  return commentText ? toSummaryLine(commentText) : group.name;
}

/**
 * Markdown link. The text falls back to the URL; brackets in the text and
 * parentheses in the URL are escaped so they cannot end the link early.
 */
function renderMarkdownLink(url: string, text?: string): string {
  const label = (text || url).replace(/[\\[\]]/g, "\\$&");
  const href = url.replace(/\(/g, "%28").replace(/\)/g, "%29");
  return `[${label}](${href})`;
}

/**
 * Builds the markdown block for a single selection: heading, optional
 * comment, file path, selector, raw HTML code block. Pure — consumes
 * the same fields `SelectionCard` displays in the sidebar.
 */
function renderSelection(item: CommentItem, index: number): string {
  const lines: string[] = [];
  const title = item.componentName ?? item.elementName;
  lines.push(`### ${index + 1}. ${title} \`<${item.tagName}>\``);
  lines.push("");

  if (item.commentText) {
    lines.push(`> ${item.commentText}`);
    lines.push("");
  }

  if (item.pageUrl) {
    lines.push(
      `- **Page:** ${renderMarkdownLink(item.pageUrl, item.pageTitle)}`,
    );
  }

  if (item.recordingUrl) {
    lines.push(
      `- **Recording:** ${renderMarkdownLink(item.recordingUrl, "Watch how we got here")}`,
    );
  }

  const filePath = extractFilePath(item.content ?? "");
  if (filePath) {
    const suffix = filePath.line !== null ? `:${filePath.line}` : "";
    lines.push(`- **File:** \`${filePath.path}${suffix}\``);
  }

  const selector = item.elementSelectors?.[0];
  if (selector) {
    lines.push(`- **Selector:** \`${selector}\``);
  }

  if (item.content) {
    const raw =
      item.content.length > RAW_HTML_MAX_CHARS
        ? `${item.content.slice(0, RAW_HTML_MAX_CHARS)}…`
        : item.content;
    lines.push("");
    lines.push("```html");
    lines.push(raw);
    lines.push("```");
  }

  return lines.join("\n");
}

/**
 * Generates the default JIRA ticket description as a markdown string.
 * The sync-server converts this to ADF before calling JIRA (ADR-0004).
 * The user can edit this in the dialog before submitting.
 *
 * Synthetic groups (backing stores for loose-ticketed items) suppress
 * the "Group:" header — the ticket reads as a single-selection ticket.
 */
export function defaultDescription(
  group: SelectionGroup,
  items: CommentItem[],
): string {
  const sections: string[] = [];

  if (!isSynthetic(group)) {
    sections.push(`Group: **${group.name}**`);
  }

  sections.push("## Selections");

  // Horizontal rule between selections only when there's more than one.
  const separator = items.length > 1 ? "\n\n---\n\n" : "\n\n";
  sections.push(items.map(renderSelection).join(separator));

  return sections.join("\n\n");
}
