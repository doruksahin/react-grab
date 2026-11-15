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
import { createSyncRequest, successData } from "./request.js";
import {
  ListCommentsResponse,
  ListGroupsResponse,
  UploadRecordingResponse,
  UploadScreenshotResponse,
} from "../generated/sync-api.zod.js";
import type { SyncHttpConfig } from "./types.js";
import { fromCommentWire, toCommentWire, toGroupWire } from "./wire.js";

const RECORDING_CONTENT_TYPE = "application/gzip";

/**
 * The storage port over HTTP, bound to one workspace. Responses are checked
 * with the Zod schemas Orval generates from the server's OpenAPI spec.
 */
export const createHttpAdapter = (config: SyncHttpConfig): StorageAdapter => {
  const request = createSyncRequest(config);
  const { workspace } = config;

  return {
    loadComments: async () => {
      const data = successData(
        "GET /comments",
        await listComments(workspace, request.options()),
      );
      return ListCommentsResponse.parse(data).map(fromCommentWire);
    },

    upsertComment: async (item) => {
      successData(
        "PUT /comments/:commentId",
        await upsertComment(
          workspace,
          item.id,
          toCommentWire(item),
          request.options(),
        ),
      );
    },

    deleteComment: async (commentId) => {
      successData(
        "DELETE /comments/:commentId",
        await deleteComment(workspace, commentId, request.options()),
      );
    },

    loadGroups: async () => {
      const data = successData(
        "GET /groups",
        await listGroups(workspace, request.options()),
      );
      return ListGroupsResponse.parse(data);
    },

    upsertGroup: async (group) => {
      successData(
        "PUT /groups/:groupId",
        await upsertGroup(
          workspace,
          group.id,
          toGroupWire(group),
          request.options(),
        ),
      );
    },

    deleteGroup: async (groupId) => {
      successData(
        "DELETE /groups/:groupId",
        await deleteGroup(workspace, groupId, request.options()),
      );
    },

    uploadScreenshot: async (selectionId, kind, blob) => {
      const response = await request.raw(
        "PUT /screenshots",
        getUploadScreenshotUrl(workspace, selectionId, kind),
        { method: "PUT", body: blob, contentType: blob.type },
      );
      return UploadScreenshotResponse.parse(await response.json()).key;
    },

    loadScreenshot: async (selectionId, kind) => {
      const response = await request.raw(
        "GET /screenshots",
        getGetScreenshotUrl(workspace, selectionId, kind),
        { method: "GET" },
      );
      return response.blob();
    },

    uploadRecording: async (commentId, gzipBlob) => {
      const response = await request.raw(
        "PUT /recordings",
        getUploadRecordingUrl(workspace, commentId),
        { method: "PUT", body: gzipBlob, contentType: RECORDING_CONTENT_TYPE },
      );
      return UploadRecordingResponse.parse(await response.json()).recordingUrl;
    },
  };
};
