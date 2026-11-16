import { createRoute, z } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-router.js";
import { jiraErrorResponses } from "../lib/jira-error-responses.js";
import {
  AddJiraAccountRequest,
  JiraAccountIdParam,
  JiraAccountSummary,
  JiraProject,
  ReplaceJiraCredentialRequest,
} from "../schemas/index.js";

/*
 * Jira accounts (ADR-0027). Every route here needs the admin token
 * (`requireAdminToken` in app.ts). No response carries a credential.
 */

const listAccounts = createRoute({
  method: "get",
  path: "/jira-accounts",
  tags: ["jira-accounts"],
  summary: "List Jira accounts",
  operationId: "listJiraAccounts",
  responses: {
    200: {
      description: "Accounts, without credentials",
      content: { "application/json": { schema: z.array(JiraAccountSummary) } },
    },
  },
});

const addAccount = createRoute({
  method: "post",
  path: "/jira-accounts",
  tags: ["jira-accounts"],
  summary: "Add a Jira account after Jira accepts its credential",
  operationId: "addJiraAccount",
  request: {
    body: {
      content: { "application/json": { schema: AddJiraAccountRequest } },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Account added",
      content: { "application/json": { schema: JiraAccountSummary } },
    },
    ...jiraErrorResponses,
  },
});

const replaceCredential = createRoute({
  method: "put",
  path: "/jira-accounts/{accountId}/credential",
  tags: ["jira-accounts"],
  summary: "Replace a Jira account's API token",
  operationId: "replaceJiraCredential",
  request: {
    params: JiraAccountIdParam,
    body: {
      content: {
        "application/json": { schema: ReplaceJiraCredentialRequest },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Credential replaced",
      content: { "application/json": { schema: JiraAccountSummary } },
    },
    ...jiraErrorResponses,
  },
});

const removeAccount = createRoute({
  method: "delete",
  path: "/jira-accounts/{accountId}",
  tags: ["jira-accounts"],
  summary: "Remove a Jira account no workspace or ticket uses",
  operationId: "removeJiraAccount",
  request: { params: JiraAccountIdParam },
  responses: {
    204: { description: "Removed, or never existed" },
    ...jiraErrorResponses,
  },
});

const listProjects = createRoute({
  method: "get",
  path: "/jira-accounts/{accountId}/projects",
  tags: ["jira-accounts"],
  summary: "Projects the account can see",
  operationId: "listJiraAccountProjects",
  request: { params: JiraAccountIdParam },
  responses: {
    200: {
      description: "Projects",
      content: { "application/json": { schema: z.array(JiraProject) } },
    },
    ...jiraErrorResponses,
  },
});

export const jiraAccountRoutes = createRouter()
  .openapi(listAccounts, async (c) =>
    c.json(await c.var.jiraAccounts.list(), 200),
  )
  .openapi(addAccount, async (c) =>
    c.json(await c.var.jiraAccounts.add(c.req.valid("json")), 201),
  )
  .openapi(replaceCredential, async (c) => {
    const { accountId } = c.req.valid("param");
    const { apiToken } = c.req.valid("json");
    return c.json(
      await c.var.jiraAccounts.replaceCredential(accountId, apiToken),
      200,
    );
  })
  .openapi(removeAccount, async (c) => {
    await c.var.jiraAccounts.remove(c.req.valid("param").accountId);
    return c.body(null, 204);
  })
  .openapi(listProjects, async (c) =>
    c.json(
      await c.var.jiraAccounts.listProjects(c.req.valid("param").accountId),
      200,
    ),
  );
