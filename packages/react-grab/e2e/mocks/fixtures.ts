/**
 * Deterministic fixture data for all 15 sync-server endpoints.
 *
 * Type shapes match the Orval-generated types in
 * `packages/react-grab/src/generated/sync-api.ts`. Inline definitions are used
 * here to avoid tsconfig resolution issues (e2e/ lives outside src/).
 */

// ---------------------------------------------------------------------------
// Inline type definitions (mirrors Orval-generated shapes)
// ---------------------------------------------------------------------------

interface HealthCheck200 {
  status: "ok";
}

interface ListComments200Item {
  id: string;
  groupId: string;
  content: string;
  elementName: string;
  tagName: string;
  componentName?: string;
  elementsCount?: number;
  elementSelectors?: string[];
  commentText?: string;
  timestamp: number;
  revealed?: boolean;
  status?: "open" | "ticketed" | "resolved";
  pageUrl?: string;
  pageTitle?: string;
  screenshotFullPage?: string;
  screenshotElement?: string;
  jiraTicketId?: string;
  capturedBy?: string;
}

interface ListGroups200Item {
  id: string;
  name: string;
  createdAt: number;
  revealed?: boolean;
  status?: "open" | "ticketed" | "resolved";
  jiraTicketId?: string;
  synthetic?: boolean;
}

interface GetJiraTicketStatus200CommentsItem {
  id: string;
  parentId: string | null;
  author: string;
  authorAvatar: string | null;
  body: string;
  createdAt: string;
}

interface GetJiraTicketStatus200 {
  status: string;
  statusCategory: string;
  assignee: string | null;
  reporter: string | null;
  assigneeAvatar: string | null;
  reporterAvatar: string | null;
  jiraUrl: string;
  labels: string[];
  comments: GetJiraTicketStatus200CommentsItem[];
  flagged?: boolean;
  flaggedAt?: string | null;
  flaggedBy?: string | null;
  flaggedByAvatar?: string | null;
}

interface CreateJiraTicket200 {
  jiraTicketId: string;
  jiraUrl: string;
}

interface AddJiraComment200 {
  id: string;
  created: string;
}

interface SearchJiraUsers200Item {
  accountId: string;
  displayName: string;
  avatarUrl: string | null;
}

interface ListJiraProjects200Item {
  key: string;
  name: string;
}

interface ListJiraIssueTypes200Item {
  id: string;
  name: string;
}

interface ListJiraPriorities200Item {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKSPACE_ID = "test-workspace";
const JIRA_PROJECT = "ATT";
const JIRA_BASE_URL = "https://adcreative.atlassian.net";

/** Deterministic timestamps (2026-01-15T10:00:00Z and onward, 1h apart). */
const TS_BASE = 1_768_474_800_000;
const TS_1H = 3_600_000;

// ---------------------------------------------------------------------------
// 1. Health check — GET /health
// ---------------------------------------------------------------------------

export const healthCheck: HealthCheck200 = { status: "ok" };

// ---------------------------------------------------------------------------
// 2. Users
// ---------------------------------------------------------------------------

export const users: SearchJiraUsers200Item[] = [
  {
    accountId: "user-alice",
    displayName: "Alice Cooper",
    avatarUrl: `${JIRA_BASE_URL}/avatar/user-alice.png`,
  },
  {
    accountId: "user-bob",
    displayName: "Bob Martinez",
    avatarUrl: `${JIRA_BASE_URL}/avatar/user-bob.png`,
  },
  {
    accountId: "user-charlie",
    displayName: "Charlie Park",
    avatarUrl: null,
  },
];

// ---------------------------------------------------------------------------
// 3. Groups — GET /api/workspaces/:id/groups
// ---------------------------------------------------------------------------

export const groups: ListGroups200Item[] = [
  {
    id: "grp-1",
    name: "Header alignment issue",
    createdAt: TS_BASE,
    revealed: true,
    status: "ticketed",
    jiraTicketId: "ATT-101",
    synthetic: false,
  },
  {
    id: "grp-2",
    name: "Footer spacing bug",
    createdAt: TS_BASE + TS_1H,
    revealed: false,
    status: "ticketed",
    jiraTicketId: "ATT-102",
    synthetic: false,
  },
  {
    id: "grp-3",
    name: "Sidebar overflow",
    createdAt: TS_BASE + TS_1H * 2,
    revealed: false,
    status: "open",
    jiraTicketId: undefined,
    synthetic: false,
  },
];

// ---------------------------------------------------------------------------
// 4. Comments — GET /api/workspaces/:id/comments
// ---------------------------------------------------------------------------

export const comments: ListComments200Item[] = [
  {
    id: "cmt-1",
    groupId: "grp-1",
    content: "<nav>...</nav>",
    elementName: "MainNav",
    tagName: "nav",
    componentName: "Header",
    elementsCount: 1,
    elementSelectors: ["nav.main-nav"],
    commentText: "Navigation bar is misaligned on mobile viewports",
    timestamp: TS_BASE,
    revealed: true,
    status: "ticketed",
    pageUrl: "https://app.example.com/dashboard",
    pageTitle: "Dashboard",
    screenshotFullPage: undefined,
    screenshotElement: undefined,
    jiraTicketId: "ATT-101",
    capturedBy: "Alice Cooper",
  },
  {
    id: "cmt-2",
    groupId: "grp-1",
    content: "<header>...</header>",
    elementName: "TopBar",
    tagName: "header",
    componentName: "Header",
    elementsCount: 1,
    elementSelectors: ["header.top-bar"],
    commentText: "Logo overlaps the search bar at 768px",
    timestamp: TS_BASE + TS_1H,
    revealed: true,
    status: "ticketed",
    pageUrl: "https://app.example.com/dashboard",
    pageTitle: "Dashboard",
    screenshotFullPage: undefined,
    screenshotElement: undefined,
    jiraTicketId: "ATT-101",
    capturedBy: "Bob Martinez",
  },
];

// ---------------------------------------------------------------------------
// 5. JIRA ticket statuses — GET /api/workspaces/:id/jira/ticket/:ticketId
// ---------------------------------------------------------------------------

export const jiraTicketStatusATT101: GetJiraTicketStatus200 = {
  status: "In Progress",
  statusCategory: "indeterminate",
  assignee: "Alice Cooper",
  reporter: "Bob Martinez",
  assigneeAvatar: `${JIRA_BASE_URL}/avatar/user-alice.png`,
  reporterAvatar: `${JIRA_BASE_URL}/avatar/user-bob.png`,
  jiraUrl: `${JIRA_BASE_URL}/browse/ATT-101`,
  labels: ["bug", "frontend", "mobile"],
  comments: [
    {
      id: "jira-cmt-1",
      parentId: null,
      author: "Alice Cooper",
      authorAvatar: `${JIRA_BASE_URL}/avatar/user-alice.png`,
      body: "Reproduced on Chrome 120, affects all breakpoints below 768px.",
      createdAt: "2026-01-15T11:00:00.000Z",
    },
    {
      id: "jira-cmt-2",
      parentId: "jira-cmt-1",
      author: "Bob Martinez",
      authorAvatar: `${JIRA_BASE_URL}/avatar/user-bob.png`,
      body: "Same here on Firefox. The flex container needs min-width.",
      createdAt: "2026-01-15T12:00:00.000Z",
    },
  ],
  flagged: false,
  flaggedAt: null,
  flaggedBy: null,
  flaggedByAvatar: null,
};

export const jiraTicketStatusATT102: GetJiraTicketStatus200 = {
  status: "To Do",
  statusCategory: "new",
  assignee: null,
  reporter: "Charlie Park",
  assigneeAvatar: null,
  reporterAvatar: null,
  jiraUrl: `${JIRA_BASE_URL}/browse/ATT-102`,
  labels: ["bug", "footer"],
  comments: [],
  flagged: false,
  flaggedAt: null,
  flaggedBy: null,
  flaggedByAvatar: null,
};

/** Lookup helper keyed by ticket ID. */
export const jiraTicketStatuses: Record<string, GetJiraTicketStatus200> = {
  "ATT-101": jiraTicketStatusATT101,
  "ATT-102": jiraTicketStatusATT102,
};

/** Lookup helper keyed by group ID (used by route handler). */
export const jiraStatusByGroup: Record<string, GetJiraTicketStatus200> = {
  "grp-1": jiraTicketStatusATT101,
  "grp-2": jiraTicketStatusATT102,
};

/**
 * Default response for every per-item write: PUT and DELETE on
 * /workspaces/:id/comments/:commentId and /workspaces/:id/groups/:groupId.
 * There is no whole-list write any more (ADR-0019).
 */
export const itemWriteResponse = { status: "ok" } as const;

/** Default response for PUT /workspaces/:id/screenshots/:id/:kind. */
export const uploadScreenshotResponse = { ok: true } as const;

// ---------------------------------------------------------------------------
// 6. Create JIRA ticket — POST /api/workspaces/:id/jira/ticket
// ---------------------------------------------------------------------------

export const createJiraTicketResponse: CreateJiraTicket200 = {
  jiraTicketId: "ATT-103",
  jiraUrl: `${JIRA_BASE_URL}/browse/ATT-103`,
};

// ---------------------------------------------------------------------------
// 7. Add JIRA comment — POST /api/workspaces/:id/jira/ticket/:ticketId/comment
// ---------------------------------------------------------------------------

export const addJiraCommentResponse: AddJiraComment200 = {
  id: "jira-cmt-new-1",
  created: "2026-01-15T14:00:00.000Z",
};

// ---------------------------------------------------------------------------
// 8. Search JIRA users — GET /api/workspaces/:id/jira/users
// ---------------------------------------------------------------------------

export const searchJiraUsers: SearchJiraUsers200Item[] = users;

// ---------------------------------------------------------------------------
// 9. List JIRA projects — GET /api/workspaces/:id/jira/projects
// ---------------------------------------------------------------------------

export const jiraProjects: ListJiraProjects200Item[] = [
  { key: "ATT", name: "AdCreative Tests" },
];

// ---------------------------------------------------------------------------
// 10. List JIRA issue types — GET /api/workspaces/:id/jira/issue-types
// ---------------------------------------------------------------------------

export const jiraIssueTypes: ListJiraIssueTypes200Item[] = [
  { id: "issuetype-1", name: "Bug" },
  { id: "issuetype-2", name: "Task" },
  { id: "issuetype-3", name: "Story" },
];

// ---------------------------------------------------------------------------
// 11. List JIRA priorities — GET /api/workspaces/:id/jira/priorities
// ---------------------------------------------------------------------------

export const jiraPriorities: ListJiraPriorities200Item[] = [
  { id: "priority-1", name: "High" },
  { id: "priority-2", name: "Medium" },
  { id: "priority-3", name: "Low" },
];

// ---------------------------------------------------------------------------
// 12. Labels (used across ticket creation / status responses)
// ---------------------------------------------------------------------------

export const jiraLabels: string[] = [
  "bug",
  "frontend",
  "mobile",
  "footer",
  "accessibility",
];

// ---------------------------------------------------------------------------
// 13-14. Screenshot endpoints — GET .../screenshot/full, .../screenshot/element
//
// 1x1 transparent PNG (67 bytes).
// ---------------------------------------------------------------------------

/** Minimal valid 1x1 transparent PNG as a base64 string. */
export const TRANSPARENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/** Minimal valid 1x1 transparent PNG as a Buffer. */
export const TRANSPARENT_PNG_BUFFER: Buffer = Buffer.from(
  TRANSPARENT_PNG_BASE64,
  "base64",
);

export const screenshotFull = TRANSPARENT_PNG_BUFFER;
export const screenshotElement = TRANSPARENT_PNG_BUFFER;

// ---------------------------------------------------------------------------
// Aggregate: all fixtures grouped by endpoint for route-handler setup
// ---------------------------------------------------------------------------

export const allFixtures = {
  healthCheck,
  groups,
  comments,
  jiraTicketStatuses,
  jiraStatusByGroup,
  createJiraTicketResponse,
  addJiraCommentResponse,
  searchJiraUsers,
  jiraProjects,
  jiraIssueTypes,
  jiraPriorities,
  jiraLabels,
  screenshotFull,
  screenshotElement,
  itemWriteResponse,
  uploadScreenshotResponse,
} as const;

// ---------------------------------------------------------------------------
// Re-export workspace constants for test setup
// ---------------------------------------------------------------------------

export { WORKSPACE_ID, JIRA_PROJECT, JIRA_BASE_URL };
