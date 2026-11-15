import { z } from "zod";
import type {
  ListComments200Item,
  ListGroups200Item,
  UploadRecording200,
  UploadScreenshot200,
} from "../generated/sync-api.js";

/*
 * Runtime checks for what the server sends. Each schema is typed against the
 * generated type, so the two cannot drift apart (SSOT: the server's Zod
 * schemas, through OpenAPI and Orval).
 */

const ITEM_STATUSES = ["open", "ticketed", "resolved"] as const;

export const ServerCommentSchema: z.ZodType<ListComments200Item> = z.object({
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
  revealed: z.boolean().optional(),
  status: z.enum(ITEM_STATUSES).optional(),
  pageUrl: z.string().optional(),
  pageTitle: z.string().optional(),
  screenshotFullPage: z.string().optional(),
  screenshotElement: z.string().optional(),
  recordingUrl: z.string().optional(),
  jiraTicketId: z.string().optional(),
  capturedBy: z.string().optional(),
});

export const ServerGroupSchema: z.ZodType<ListGroups200Item> = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  revealed: z.boolean().optional(),
  status: z.enum(ITEM_STATUSES).optional(),
  jiraTicketId: z.string().optional(),
  synthetic: z.boolean().optional(),
});

export const UploadResultSchema: z.ZodType<UploadScreenshot200> = z.object({
  key: z.string(),
});

export const RecordingUploadResultSchema: z.ZodType<UploadRecording200> =
  z.object({
    recordingUrl: z.string().url(),
  });
