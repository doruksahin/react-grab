import { createStore } from "solid-js/store";
import type { CommentItem } from "../../../types.js";
import type { SelectionGroupWithJira } from "../../selection-groups/types.js";
import type { JiraTicketStatus } from "../types.js";

export interface SyncStoreShape {
  groups: SelectionGroupWithJira[];
  comments: CommentItem[];
  workspace: string | null;
  status: "idle" | "loading" | "synced" | "local" | "error";
  error: string | null;
}

const INITIAL_STATE: SyncStoreShape = {
  groups: [],
  comments: [],
  workspace: null,
  status: "idle",
  error: null,
};

export const createSyncStore = () => {
  const [store, setStore] = createStore<SyncStoreShape>({ ...INITIAL_STATE });

  return {
    store,
    setWorkspace: (workspace: string) => {
      setStore({ workspace });
    },
    setStatus: (status: SyncStoreShape["status"], error?: string) => {
      setStore({ status, error: error ?? null });
    },
    updateGroup: (groupId: string, patch: Partial<SelectionGroupWithJira>) => {
      setStore("groups", (g) => g.id === groupId, patch);
    },
    setGroups: (next: SelectionGroupWithJira[]) => {
      setStore("groups", next);
    },
    setComments: (next: CommentItem[]) => {
      setStore("comments", next);
    },
    // Fine-grained per-group JIRA status update — uses path-based setStore
    // so only the affected group's properties change in the store.
    updateJiraStatus: (groupId: string, status: JiraTicketStatus) => {
      const resolved = status.statusCategory.toLowerCase() === "done";
      setStore("groups", (g) => g.id === groupId, {
        jiraStatus: status.status,
        jiraStatusCategory: status.statusCategory,
        jiraAssignee: status.assignee,
        jiraReporter: status.reporter,
        jiraAssigneeAvatar: status.assigneeAvatar,
        jiraReporterAvatar: status.reporterAvatar,
        jiraLabels: status.labels,
        jiraComments: status.comments,
        jiraResolved: resolved,
        jiraUrl: status.jiraUrl,
        jiraFlagged: status.flagged ?? false,
        jiraFlaggedAt: status.flaggedAt ?? null,
        jiraFlaggedBy: status.flaggedBy ?? null,
        jiraFlaggedByAvatar: status.flaggedByAvatar ?? null,
        jiraPriority: status.priority,
        jiraIssueType: status.issueType,
        jiraDueDate: status.dueDate,
      });
    },
  };
};

export type SyncStoreHandle = ReturnType<typeof createSyncStore>;
