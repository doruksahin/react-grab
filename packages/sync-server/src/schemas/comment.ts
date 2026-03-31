import { z } from "@hono/zod-openapi";

export const SelectionStatus = z.enum(["open", "ticketed", "resolved"]).openapi({
  description: "Lifecycle status of a selection",
});

export const CommentItem = z.object({
  id: z.string(),
  groupId: z.string(),
  content: z.string().openapi({ description: "Element HTML snapshot" }),
  elementName: z.string(),
  tagName: z.string(),
  componentName: z.string().optional(),
  elementsCount: z.number().int().optional(),
  elementSelectors: z.array(z.string()).optional(),
  commentText: z.string().optional(),
  timestamp: z.number(),
  revealed: z.boolean(),
  status: SelectionStatus.optional(),
  pageUrl: z.string().optional(),
  pageTitle: z.string().optional(),
  screenshotFullPage: z.string().optional().openapi({ description: "R2 key for full-page screenshot" }),
  screenshotElement: z.string().optional().openapi({ description: "R2 key for element screenshot" }),
  jiraTicketId: z.string().optional(),
  capturedBy: z.string().optional(),
});

export const CommentItemArray = z.array(CommentItem);
