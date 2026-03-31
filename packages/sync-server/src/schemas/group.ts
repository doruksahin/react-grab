import { z } from "@hono/zod-openapi";

export const SelectionGroup = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  revealed: z.boolean(),
});

export const SelectionGroupArray = z.array(SelectionGroup);
