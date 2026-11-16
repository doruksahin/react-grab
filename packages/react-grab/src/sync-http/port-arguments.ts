import { z } from "zod";
import type { JiraPort, StorageAdapter } from "../features/sync/types.js";
import {
  AddJiraCommentBody,
  CreateJiraTicketBody,
  SearchJiraUsersQueryParams,
  UploadScreenshotParams,
  UpsertCommentBody,
  UpsertGroupBody,
} from "../generated/sync-api.zod.js";

/*
 * One argument schema per port method, built from the schemas Orval
 * generates from the server's OpenAPI spec. A caller that does not trust
 * where the arguments come from (the extension's gateway, ADR-0023) parses
 * them with these before calling a port. The keys are the port's methods,
 * so the record is also the list of methods such a caller may call.
 */

const DOT_SEGMENTS = new Set([".", ".."]);

/** An id that ends up as one URL path segment: no slashes, no dot segment. */
export const pathIdSchema = z
  .string()
  .min(1)
  .refine((value) => !/[/\\]/.test(value), "An id cannot contain a slash")
  .refine((value) => !DOT_SEGMENTS.has(value), "An id cannot be . or ..");

const screenshotKindSchema = UploadScreenshotParams.shape.type;
const blobSchema = z.instanceof(Blob);

type PortArguments<Port> = {
  [Method in keyof Port]: Port[Method] extends (...args: infer Args) => unknown
    ? z.ZodType<Args>
    : never;
};

export const STORAGE_ARGUMENTS = {
  loadComments: z.tuple([]),
  upsertComment: z.tuple([
    UpsertCommentBody.extend({
      id: pathIdSchema,
      groupId: z.string().nullable(),
    }),
  ]),
  deleteComment: z.tuple([pathIdSchema]),
  loadGroups: z.tuple([]),
  upsertGroup: z.tuple([UpsertGroupBody.extend({ id: pathIdSchema })]),
  deleteGroup: z.tuple([pathIdSchema]),
  uploadScreenshot: z.tuple([pathIdSchema, screenshotKindSchema, blobSchema]),
  loadScreenshot: z.tuple([pathIdSchema, screenshotKindSchema]),
  uploadRecording: z.tuple([pathIdSchema, blobSchema]),
} satisfies PortArguments<StorageAdapter>;

/*
 * No Jira argument names a project: the workspace's destination decides it
 * (ADR-0027), so a page cannot send tickets anywhere else.
 */
export const JIRA_ARGUMENTS = {
  getDestination: z.tuple([]),
  listIssueTypes: z.tuple([]),
  listPriorities: z.tuple([]),
  listLabels: z.tuple([]),
  getTicketStatus: z.tuple([pathIdSchema]),
  createTicket: z.tuple([
    pathIdSchema,
    CreateJiraTicketBody.omit({ projectKey: true }).strict(),
  ]),
  addComment: z.tuple([pathIdSchema, AddJiraCommentBody]),
  searchUsers: z.tuple([SearchJiraUsersQueryParams.shape.query]),
} satisfies PortArguments<JiraPort>;
