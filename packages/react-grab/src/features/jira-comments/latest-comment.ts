import type { JiraComment } from "./types.js";

/**
 * The comment a label card shows: the newest by `createdAt`, replies
 * included (a reply is often the latest word on a ticket). Comments still
 * being sent are left out, since they are not in Jira yet. Comments with an
 * unreadable date count as oldest. Undefined when there is none.
 */
export const latestComment = (
  comments: readonly JiraComment[],
): JiraComment | undefined => {
  let latest: JiraComment | undefined;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const comment of comments) {
    if (comment.sending) continue;
    const parsed = Date.parse(comment.createdAt);
    const time = Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
    if (latest === undefined || time >= latestTime) {
      latest = comment;
      latestTime = time;
    }
  }
  return latest;
};

/** How many comments a ticket has in Jira (sending placeholders left out). */
export const sentCommentCount = (comments: readonly JiraComment[]): number =>
  comments.filter((comment) => !comment.sending).length;
