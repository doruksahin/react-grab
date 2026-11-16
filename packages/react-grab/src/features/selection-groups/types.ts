import type { Accessor, Setter } from "solid-js";
import type { ServerSelectionGroup } from "../../generated/types.js";
import type { CommentItem } from "../../shared-types.js";
import type { JiraComment } from "../jira-comments/types.js";
import type {
  BulkMoveResult,
  DeleteGroupResult,
  MoveResult,
  RemoveResult,
} from "./business/membership-policy.js";

/**
 * Application-level group type. Extends the server type with UI-only fields.
 * Extends the server type with UI-layer fields that are persisted locally
 * (localStorage / D1 via the storage adapter) but not part of the OpenAPI spec.
 */
export interface SelectionGroup extends ServerSelectionGroup {
  /** True when JIRA polling confirms statusCategory === "done". Persisted so it
   *  survives page refresh without waiting for the next poll cycle. */
  jiraResolved?: boolean;
  /** True if this group was auto-created when a loose selection earned a
   *  ticket. Synthetic groups are hidden on user-facing surfaces (GroupList,
   *  picker, stats, filters); their single item renders as a loose card via
   *  `isPresentedAsLoose`. The flag is permanent, and the membership policy
   *  never moves a selection into one (see `presentedGroups` for older
   *  data that has several members). */
  synthetic?: boolean;
}

/**
 * A group as the sync layer holds it: the persisted group plus the Jira
 * fields the status poll fills in (SPEC-003). jiraResolved is persisted on
 * SelectionGroup; the fields below come from the sync server's Jira status
 * and are refreshed by polling, not stored locally.
 */
export interface SelectionGroupWithJira extends SelectionGroup {
  /** Raw JIRA status name, e.g. "In Progress" */
  jiraStatus?: string;
  /** JIRA status category, e.g. "In Progress", "Done", "To Do" */
  jiraStatusCategory?: string;
  /** Full JIRA ticket URL, e.g. "https://company.atlassian.net/browse/ATT-123" */
  jiraUrl?: string;
  /** JIRA assignee display name, null if unassigned */
  jiraAssignee?: string | null;
  /** JIRA reporter display name, null if unknown */
  jiraReporter?: string | null;
  /** Avatar URL (48×48) for the Jira assignee, null if unassigned or unavailable */
  jiraAssigneeAvatar?: string | null;
  /** Avatar URL (48×48) for the Jira reporter, null if unavailable */
  jiraReporterAvatar?: string | null;
  /** JIRA labels array, e.g. ["UI Ticket Manager", "frontend"] */
  jiraLabels?: string[];
  /** Jira comments fetched alongside status. Flat list with parentId for threading. */
  jiraComments?: JiraComment[];
  jiraFlagged?: boolean;
  /** ISO timestamp of when the ticket was flagged (from JIRA changelog) */
  jiraFlaggedAt?: string | null;
  /** Display name of who flagged the ticket */
  jiraFlaggedBy?: string | null;
  /** Avatar URL (48x48) of who flagged the ticket */
  jiraFlaggedByAvatar?: string | null;
  /** JIRA priority name, e.g. "High", "Medium", "Low" */
  jiraPriority?: string | null;
  /** JIRA issue type name, e.g. "Bug", "Task", "Story" */
  jiraIssueType?: string | null;
  /** JIRA due date as ISO string, e.g. "2026-04-20", null if not set */
  jiraDueDate?: string | null;
}

/**
 * Dependencies injected from core/index.tsx into the selection groups module.
 */
export interface SelectionGroupsDeps {
  commentItems: () => CommentItem[];
  persistCommentItems: (items: CommentItem[]) => CommentItem[];
  groups: () => SelectionGroupWithJira[];
  persistGroups: (groups: SelectionGroupWithJira[]) => SelectionGroupWithJira[];
}

/**
 * Public API returned by createSelectionGroups.
 */
export interface SelectionGroupsAPI {
  groups: Accessor<SelectionGroupWithJira[]>;
  activeGroupId: Accessor<string | null>;
  setActiveGroupId: Setter<string | null>;
  handleAddGroup: (name: string) => void;
  handleRenameGroup: (groupId: string, name: string) => void;
  handleDeleteGroup: (groupId: string) => DeleteGroupResult;
  handleMoveItem: (itemId: string, groupId: string | null) => MoveResult;
  handleMoveItems: (itemIds: Set<string>, groupId: string) => BulkMoveResult;
  /** Remove a selection; refused for a locked one. GCs empty synthetic groups. */
  handleRemoveItem: (itemId: string) => RemoveResult;
  /** Record the ticket created for a group; it then takes no new selections. */
  markTicketCreated: (
    groupId: string,
    jiraTicketId: string,
    jiraUrl: string,
  ) => void;
  /** Record that a group's ticket is resolved in Jira. */
  markResolved: (groupId: string) => void;
  /** Guarantee the item has a group. Returns the groupId to assign.
   *  Uses activeGroupId when set, otherwise creates a synthetic group. */
  ensureGroupForItem: (
    item: { componentName?: string; elementName: string },
    selectedGroupId?: string | null,
  ) => string;
}

/**
 * All group-related props passed through the renderer chain.
 * ReactGrabRendererProps extends this. Component props Pick<> their subset.
 */
export interface SelectionGroupsViewProps {
  groups?: SelectionGroupWithJira[];
  activeGroupId?: string | null;
  onActiveGroupChange?: (groupId: string | null) => void;
  onAddGroup?: (name: string) => void;
  onRenameGroup?: (groupId: string, name: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onToggleGroupRevealed?: (groupId: string) => void;
  onMoveItem?: (itemId: string, groupId: string | null) => void;
  onMoveItems?: (itemIds: Set<string>, groupId: string) => void;
  /** Remove a selection permanently. No-op when the selection is
   *  locked by the ticket-lock rule. */
  onRemoveItem?: (itemId: string) => void;
  onJiraResolved?: (groupId: string) => void;
}
