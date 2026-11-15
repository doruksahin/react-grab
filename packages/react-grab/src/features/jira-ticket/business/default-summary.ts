import type { SelectionGroup } from "../../selection-groups/types.js";
import type { CommentItem } from "../../../types.js";
import { isSynthetic } from "../../selection-groups/business/synthetic-group.js";

const SUMMARY_MAX_CHARS = 80;

/** Jira summaries are one line: line breaks and runs of spaces become one space. */
export const normalizeSummary = (text: string): string =>
  text.replace(/\s+/g, " ").trim();

/** The first non-empty line of a text, cut at a word boundary to fit. */
export const toSummaryLine = (text: string): string => {
  const line = normalizeSummary(
    text.split("\n").find((part) => part.trim()) ?? "",
  );
  if (line.length <= SUMMARY_MAX_CHARS) return line;
  const cut = line.slice(0, SUMMARY_MAX_CHARS - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const wordCut =
    lastSpace > SUMMARY_MAX_CHARS / 2 ? cut.slice(0, lastSpace) : cut;
  return `${wordCut.trimEnd()}…`;
};

/**
 * Generates the default Jira ticket summary. A group the user named keeps
 * its name; a single loose selection (synthetic group) starts from what the
 * user wrote, since its name is only the component name. Falls back to the
 * group name when there is no comment text.
 */
export const defaultSummary = (
  group: SelectionGroup,
  items: CommentItem[],
): string => {
  if (!isSynthetic(group)) return group.name;
  const commentText = items.find((item) =>
    item.commentText?.trim(),
  )?.commentText;
  return commentText ? toSummaryLine(commentText) : group.name;
};
