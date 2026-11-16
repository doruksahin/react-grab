import { z } from "@hono/zod-openapi";

/** Where a workspace's new tickets go, and as whom (ADR-0027). */
export const JiraDestination = z
  .object({
    siteUrl: z.string().openapi({ example: "https://acme.atlassian.net" }),
    projectKey: z.string().openapi({ example: "SCRUM" }),
    signsInAs: z.string().nullable().openapi({
      description:
        "Display name of the account tickets are created as; null for the environment account",
      example: "Ada Lovelace",
    }),
  })
  .openapi("JiraDestination");

export const WorkspaceSummary = z
  .object({
    id: z.string().openapi({ example: "cognograph-workspace" }),
    jiraAccountId: z.string().nullable(),
    jiraProjectKey: z.string().nullable(),
    siteUrl: z.string().nullable(),
  })
  .openapi("WorkspaceSummary");

export const SetJiraDestinationRequest = z.object({
  jiraAccountId: z.string().min(1),
  projectKey: z.string().trim().min(1).openapi({ example: "SCRUM" }),
});

/**
 * Until the cut-over, a workspace without a destination still takes the
 * client's project key (ADR-0027 rollout). Ignored once it has a destination.
 */
export const LegacyProjectKeyQuery = z.object({
  projectKey: z.string().optional().openapi({
    description:
      "Deprecated: used only for a workspace without a Jira destination",
    example: "SCRUM",
  }),
});
