import type { Page, Route, Request } from "@playwright/test";
import * as fixtures from "./fixtures.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CapturedRequest {
  url: string;
  method: string;
  body: unknown;
  timestamp: number;
}

export type RouteHandler =
  | Record<string, unknown>
  | unknown[]
  | string
  | ((request: Request) => unknown | Promise<unknown>);

export interface MockOverrides {
  health: RouteHandler;
  listComments: RouteHandler;
  upsertComment: RouteHandler;
  deleteComment: RouteHandler;
  listGroups: RouteHandler;
  upsertGroup: RouteHandler;
  deleteGroup: RouteHandler;
  getScreenshot: RouteHandler;
  uploadScreenshot: RouteHandler;
  createJiraTicket: RouteHandler;
  getJiraTicketStatus: RouteHandler;
  addJiraComment: RouteHandler;
  listJiraProjects: RouteHandler;
  listJiraIssueTypes: RouteHandler;
  listJiraPriorities: RouteHandler;
  listJiraLabels: RouteHandler;
  searchJiraUsers: RouteHandler;
}

export interface MockServerHandle {
  override<K extends keyof MockOverrides>(
    endpoint: K,
    handler: MockOverrides[K],
  ): void;
  requests(endpoint: keyof MockOverrides): CapturedRequest[];
  reset(): void;
}

// ---------------------------------------------------------------------------
// Endpoint definitions
// ---------------------------------------------------------------------------

interface EndpointDef {
  pattern: string;
  method: string;
  binary?: boolean;
}

const ENDPOINTS: Record<keyof MockOverrides, EndpointDef> = {
  health: { pattern: "**/health", method: "GET" },
  listComments: { pattern: "**/workspaces/*/comments", method: "GET" },
  upsertComment: { pattern: "**/workspaces/*/comments/*", method: "PUT" },
  deleteComment: { pattern: "**/workspaces/*/comments/*", method: "DELETE" },
  listGroups: { pattern: "**/workspaces/*/groups", method: "GET" },
  upsertGroup: { pattern: "**/workspaces/*/groups/*", method: "PUT" },
  deleteGroup: { pattern: "**/workspaces/*/groups/*", method: "DELETE" },
  getScreenshot: {
    pattern: "**/workspaces/*/screenshots/*/*",
    method: "GET",
    binary: true,
  },
  uploadScreenshot: {
    pattern: "**/workspaces/*/screenshots/*/*",
    method: "PUT",
    binary: true,
  },
  createJiraTicket: {
    pattern: "**/workspaces/*/groups/*/jira-ticket",
    method: "POST",
  },
  getJiraTicketStatus: {
    pattern: "**/workspaces/*/groups/*/jira-status",
    method: "GET",
  },
  addJiraComment: {
    pattern: "**/workspaces/*/groups/*/jira-comment",
    method: "POST",
  },
  listJiraProjects: { pattern: "**/jira/projects", method: "GET" },
  listJiraIssueTypes: { pattern: "**/jira/issue-types*", method: "GET" },
  listJiraPriorities: { pattern: "**/jira/priorities", method: "GET" },
  listJiraLabels: { pattern: "**/jira/labels*", method: "GET" },
  searchJiraUsers: { pattern: "**/jira/users*", method: "GET" },
};

// ---------------------------------------------------------------------------
// Default fixtures
// ---------------------------------------------------------------------------

const DEFAULT_FIXTURES: Record<keyof MockOverrides, unknown> = {
  health: fixtures.healthCheck,
  listComments: fixtures.comments,
  upsertComment: fixtures.itemWriteResponse,
  deleteComment: fixtures.itemWriteResponse,
  listGroups: fixtures.groups,
  upsertGroup: fixtures.itemWriteResponse,
  deleteGroup: fixtures.itemWriteResponse,
  getScreenshot: fixtures.screenshotFull,
  uploadScreenshot: fixtures.uploadScreenshotResponse,
  createJiraTicket: fixtures.createJiraTicketResponse,
  getJiraTicketStatus: null, // handled by group-specific logic below
  addJiraComment: fixtures.addJiraCommentResponse,
  listJiraProjects: fixtures.jiraProjects,
  listJiraIssueTypes: fixtures.jiraIssueTypes,
  listJiraPriorities: fixtures.jiraPriorities,
  listJiraLabels: fixtures.jiraLabels,
  searchJiraUsers: fixtures.searchJiraUsers,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractGroupIdFromUrl(url: string): string | null {
  const match = url.match(/\/groups\/([^/]+)\/jira-/);
  return match ? match[1] : null;
}

function defaultJiraStatusHandler(request: Request): unknown {
  const groupId = extractGroupIdFromUrl(request.url());
  if (groupId && groupId in fixtures.jiraStatusByGroup) {
    return fixtures.jiraStatusByGroup[
      groupId as keyof typeof fixtures.jiraStatusByGroup
    ];
  }
  return null;
}

function captureRequest(request: Request): CapturedRequest {
  let body: unknown = null;
  try {
    body = request.postDataJSON();
  } catch {
    body = request.postData();
  }

  return {
    url: request.url(),
    method: request.method(),
    body,
    timestamp: Date.now(),
  };
}

async function resolveHandler(
  handler: RouteHandler,
  request: Request,
): Promise<unknown> {
  if (typeof handler === "function") {
    return await handler(request);
  }
  return handler;
}

function fulfillRoute(
  route: Route,
  data: unknown,
  binary: boolean,
): Promise<void> {
  if (binary) {
    const body = data instanceof Buffer ? data : Buffer.from([]);
    return route.fulfill({
      status: 200,
      contentType: "image/png",
      body,
    });
  }

  if (data === null) {
    return route.fulfill({ status: 404, body: "Not Found" });
  }

  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: typeof data === "string" ? data : JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function mockSyncServer(
  page: Page,
  overrides?: Partial<MockOverrides>,
): Promise<MockServerHandle> {
  const activeOverrides = new Map<keyof MockOverrides, RouteHandler>();
  const requestLog = new Map<keyof MockOverrides, CapturedRequest[]>();

  // Seed initial overrides
  if (overrides) {
    for (const [key, handler] of Object.entries(overrides)) {
      activeOverrides.set(key as keyof MockOverrides, handler as RouteHandler);
    }
  }

  // Initialize request log buckets
  for (const key of Object.keys(ENDPOINTS)) {
    requestLog.set(key as keyof MockOverrides, []);
  }

  // Some URL patterns are shared between two endpoints (e.g. GET vs PUT on
  // the same path). We group endpoints by pattern so we register only one
  // `page.route()` handler per pattern and disambiguate by HTTP method inside
  // the callback.
  const patternToEndpoints = new Map<
    string,
    Array<{ key: keyof MockOverrides; def: EndpointDef }>
  >();

  for (const [key, def] of Object.entries(ENDPOINTS)) {
    const group = patternToEndpoints.get(def.pattern) ?? [];
    group.push({ key: key as keyof MockOverrides, def });
    patternToEndpoints.set(def.pattern, group);
  }

  for (const [pattern, endpoints] of patternToEndpoints) {
    await page.route(pattern, async (route) => {
      const request = route.request();
      const method = request.method();

      // Find the matching endpoint for this method
      const match = endpoints.find((ep) => ep.def.method === method);
      if (!match) {
        await route.fallback();
        return;
      }

      const { key, def } = match;

      // Capture the request
      requestLog.get(key)!.push(captureRequest(request));

      // Resolve the response data
      let handler: RouteHandler | undefined = activeOverrides.get(key);

      if (handler === undefined) {
        // Special-case: getJiraTicketStatus uses group-id routing by default
        if (key === "getJiraTicketStatus") {
          const data = defaultJiraStatusHandler(request);
          await fulfillRoute(route, data, Boolean(def.binary));
          return;
        }

        const data = DEFAULT_FIXTURES[key];
        await fulfillRoute(route, data, Boolean(def.binary));
        return;
      }

      const data = await resolveHandler(handler, request);
      await fulfillRoute(route, data, Boolean(def.binary));
    });
  }

  // ------ Handle ------

  const handle: MockServerHandle = {
    override<K extends keyof MockOverrides>(
      endpoint: K,
      handler: MockOverrides[K],
    ) {
      activeOverrides.set(endpoint, handler);
    },

    requests(endpoint: keyof MockOverrides): CapturedRequest[] {
      return requestLog.get(endpoint) ?? [];
    },

    reset() {
      activeOverrides.clear();
      for (const [key] of requestLog) {
        requestLog.set(key, []);
      }
    },
  };

  return handle;
}
