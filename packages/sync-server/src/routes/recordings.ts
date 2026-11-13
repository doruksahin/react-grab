import { createRoute, z } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-router.js";
import { renderReplayPage } from "../lib/replay-page.js";

/**
 * Session recordings (SPEC-020, ADR-0021).
 *
 * Upload sits under /workspaces and needs the API token like every data route.
 * The share route sits under /r: the random share id is the credential
 * (a capability URL), so a Jira reader can watch without a token.
 */

const recordingKey = (shareId: string): string =>
  `recordings/${shareId}.json.gz`;

const RECORDING_CONTENT_TYPE = "application/gzip";

const ErrorResponse = z.object({ error: z.string() });

const uploadRecording = createRoute({
  method: "put",
  path: "/workspaces/{id}/recordings/{commentId}",
  tags: ["recordings"],
  summary: "Upload the recording that led to a comment",
  operationId: "uploadRecording",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Workspace ID" }),
      commentId: z.string().openapi({ description: "Comment ID" }),
    }),
    body: {
      content: { [RECORDING_CONTENT_TYPE]: { schema: z.any() } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Stored; the link anyone can open to watch it",
      content: {
        "application/json": {
          schema: z.object({ recordingUrl: z.string().url() }),
        },
      },
    },
    415: {
      description: "Body is not gzip",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

const ShareParams = z.object({
  shareId: z.string().uuid().openapi({ description: "Share id from the link" }),
});

const getRecordingShare = createRoute({
  method: "get",
  path: "/r/{shareId}",
  tags: ["recordings"],
  summary: "Watch a recording (public, the link is the credential)",
  operationId: "getRecordingShare",
  request: {
    params: ShareParams,
    query: z.object({
      events: z.string().optional().openapi({
        description: "Present: return the gzip events instead of the page",
      }),
    }),
  },
  responses: {
    200: { description: "Player page, or the gzip events with ?events" },
    404: {
      description: "Unknown share id",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

// W3C TAG capability-URL guidance: keep the link out of referrers and indexes.
const CAPABILITY_HEADERS = {
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
};

export const recordingUploadRoutes = createRouter().openapi(
  uploadRecording,
  async (c) => {
    const contentType = c.req.header("Content-Type") ?? "";
    if (!contentType.startsWith(RECORDING_CONTENT_TYPE)) {
      return c.json({ error: "Expected application/gzip" }, 415);
    }
    const shareId = crypto.randomUUID();
    await c.var.screenshots.upload(
      recordingKey(shareId),
      await c.req.arrayBuffer(),
      RECORDING_CONTENT_TYPE,
    );
    const recordingUrl = new URL(`/r/${shareId}`, c.req.url).href;
    return c.json({ recordingUrl }, 200);
  },
);

export const recordingShareRoutes = createRouter().openapi(
  getRecordingShare,
  async (c) => {
    const { shareId } = c.req.valid("param");
    const stored = await c.var.screenshots.get(recordingKey(shareId));
    if (!stored) {
      return c.json({ error: "Recording not found" }, 404, CAPABILITY_HEADERS);
    }
    if (c.req.valid("query").events !== undefined) {
      return new Response(stored.body, {
        headers: {
          "Content-Type": RECORDING_CONTENT_TYPE,
          ...CAPABILITY_HEADERS,
        },
      });
    }
    await stored.body.cancel();
    return c.html(
      renderReplayPage(`/r/${shareId}?events`),
      200,
      CAPABILITY_HEADERS,
    );
  },
);
