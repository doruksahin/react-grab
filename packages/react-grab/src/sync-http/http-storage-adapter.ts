import { z } from "zod";
import type { StorageAdapter } from "../features/sync/types.js";
import {
  deleteComment,
  deleteGroup,
  getGetScreenshotUrl,
  getUploadRecordingUrl,
  getUploadScreenshotUrl,
  listComments,
  listGroups,
  upsertComment,
  upsertGroup,
} from "../generated/sync-api.js";
import { createSyncRequest, pathSegment, successData } from "./request.js";
import {
  RecordingUploadResultSchema,
  ServerCommentSchema,
  ServerGroupSchema,
  UploadResultSchema,
} from "./schemas.js";
import type { SyncHttpConfig } from "./types.js";
import { fromCommentWire, toCommentWire, toGroupWire } from "./wire.js";

const RECORDING_CONTENT_TYPE = "application/gzip";

/**
 * The storage port over HTTP, bound to one workspace. Sends every field it is
 * given, `revealed` included; whether revealed state is synced is the
 * overlay's policy, applied before the port (features/sync/store).
 */
export const createHttpAdapter = (config: SyncHttpConfig): StorageAdapter => {
  const request = createSyncRequest(config);
  const workspace = pathSegment(config.workspace);

  return {
    loadComments: async () => {
      const data = successData(
        "GET /comments",
        await listComments(workspace, request.options()),
      );
      return z.array(ServerCommentSchema).parse(data).map(fromCommentWire);
    },

    upsertComment: async (item) => {
      successData(
        "PUT /comments/:commentId",
        await upsertComment(
          workspace,
          pathSegment(item.id),
          toCommentWire(item, true),
          request.options(),
        ),
      );
    },

    deleteComment: async (commentId) => {
      successData(
        "DELETE /comments/:commentId",
        await deleteComment(
          workspace,
          pathSegment(commentId),
          request.options(),
        ),
      );
    },

    loadGroups: async () => {
      const data = successData(
        "GET /groups",
        await listGroups(workspace, request.options()),
      );
      return z.array(ServerGroupSchema).parse(data);
    },

    upsertGroup: async (group) => {
      successData(
        "PUT /groups/:groupId",
        await upsertGroup(
          workspace,
          pathSegment(group.id),
          toGroupWire(group, true),
          request.options(),
        ),
      );
    },

    deleteGroup: async (groupId) => {
      successData(
        "DELETE /groups/:groupId",
        await deleteGroup(workspace, pathSegment(groupId), request.options()),
      );
    },

    uploadScreenshot: async (selectionId, kind, blob) => {
      const response = await request.raw(
        "PUT /screenshots",
        getUploadScreenshotUrl(workspace, pathSegment(selectionId), kind),
        { method: "PUT", body: blob, contentType: blob.type },
      );
      return UploadResultSchema.parse(await response.json()).key;
    },

    loadScreenshot: async (selectionId, kind) => {
      const response = await request.raw(
        "GET /screenshots",
        getGetScreenshotUrl(workspace, pathSegment(selectionId), kind),
        { method: "GET" },
      );
      return response.blob();
    },

    uploadRecording: async (commentId, gzipBlob) => {
      const response = await request.raw(
        "PUT /recordings",
        getUploadRecordingUrl(workspace, pathSegment(commentId)),
        { method: "PUT", body: gzipBlob, contentType: RECORDING_CONTENT_TYPE },
      );
      return RecordingUploadResultSchema.parse(await response.json())
        .recordingUrl;
    },
  };
};
