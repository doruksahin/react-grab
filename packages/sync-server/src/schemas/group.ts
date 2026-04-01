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
});

export const SelectionGroupArray = z.array(SelectionGroup);
