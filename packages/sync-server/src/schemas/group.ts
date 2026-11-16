import { z } from "@hono/zod-openapi";

export const GroupStatus = z.enum(["open", "ticketed", "resolved"]).openapi({
  description: "Lifecycle status of a group",
});

export const SelectionGroup = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  revealed: z.boolean().optional(),
  status: GroupStatus.optional(),
  jiraTicketId: z.string().optional(),
  synthetic: z.boolean().optional(),
  archivedAt: z.number().optional().openapi({
    description:
      "When the group was archived (epoch ms); absent while it is active (ADR-0030)",
  }),
});

export const SelectionGroupArray = z.array(SelectionGroup);

/**
 * What a client may write to a group. `status` and `jiraTicketId` are set by
 * the server when it creates the Jira ticket (`updateGroupJira`), and
 * `archivedAt` by the archive routes, so they are read-only to clients — see
 * ADR-0019 and ADR-0030. Unknown keys are stripped, so a client that still
 * sends them cannot overwrite the server's values.
 */
export const SelectionGroupWrite = SelectionGroup.omit({
  status: true,
  jiraTicketId: true,
  archivedAt: true,
});
