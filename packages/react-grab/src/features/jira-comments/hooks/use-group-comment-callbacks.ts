import type { Accessor } from "solid-js";
import { useSyncContext } from "../../sync/sync-context.js";
import type { GroupCommentCallbacks } from "../types.js";

/**
 * Comment submit, @mention search and status refresh for a group's Jira
 * thread, through the Jira port. Undefined while there is no Jira port, so
 * surfaces hide the composer instead of offering a submit that cannot work.
 */
export const useGroupCommentCallbacks = (): Accessor<
  GroupCommentCallbacks | undefined
> => {
  const sync = useSyncContext();

  return () => {
    const jira = sync.jira();
    if (!jira) return undefined;
    return {
      onSubmitComment: (groupId, markdown, mentions, parentId) =>
        jira.addComment(groupId, { body: markdown, mentions, parentId }),
      onSearchUsers: async (query) => {
        try {
          return await jira.searchUsers(query);
        } catch {
          return [];
        }
      },
      onRefreshStatus: (groupId) => {
        void sync.refreshJiraStatus(groupId);
      },
    };
  };
};
