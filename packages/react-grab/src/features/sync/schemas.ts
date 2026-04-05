import { z } from "zod";

export const CommentItemSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  content: z.string(),
  elementName: z.string(),
  tagName: z.string(),
  componentName: z.string().optional(),
  elementsCount: z.number().optional(),
  elementSelectors: z.array(z.string()).optional(),
  commentText: z.string().optional(),
  timestamp: z.number(),
  status: z.enum(["open", "ticketed", "resolved"]).optional(),
  pageUrl: z.string().optional(),
  pageTitle: z.string().optional(),
  screenshotFullPage: z.string().optional(),
  screenshotElement: z.string().optional(),
  jiraTicketId: z.string().optional(),
  capturedBy: z.string().optional(),
});

export const SelectionGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  status: z.enum(["open", "ticketed", "resolved"]).optional(),
  jiraTicketId: z.string().optional(),
});

export const UploadResultSchema = z.object({
  key: z.string(),
});
