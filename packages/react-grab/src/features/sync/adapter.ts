import { z } from "zod";
import type { CommentItem } from "../../types.js";
import type { SelectionGroup } from "../selection-groups/types.js";
import type { StorageAdapter, SyncConfig } from "./types.js";
import {
  CommentItemSchema,
  SelectionGroupSchema,
  UploadResultSchema,
} from "./schemas.js";
import {
  toCommentWire,
  toGroupWire,
  mergeRevealedIntoComments,
  mergeRevealedIntoGroups,
} from "./transforms.js";
import {
  upsertComment as putComment,
  deleteComment as removeComment,
  upsertGroup as putGroup,
  deleteGroup as removeGroup,
} from "../../generated/sync-api.js";
import { apiAuthHeaders } from "../../generated/custom-fetch.js";

const expectOk = (operation: string, status: number) => {
  if (status < 200 || status >= 300) {
    throw new Error(`${operation} failed: ${status}`);
  }
};

export const createHttpAdapter = (config: SyncConfig): StorageAdapter => {
  const baseUrl = `${config.serverUrl}/workspaces/${encodeURIComponent(config.workspace)}`;

  const handleError = (error: unknown): never => {
    const err = error instanceof Error ? error : new Error(String(error));
    config.onSyncError(err);
    throw err;
  };

  return {
    loadComments: async (): Promise<CommentItem[]> => {
      try {
        const response = await fetch(`${baseUrl}/comments`, {
          headers: apiAuthHeaders(),
        });
        if (!response.ok) {
          throw new Error(`GET /comments failed: ${response.status}`);
        }
        if (config.syncRevealedState) {
          const raw = await response.json();
          const parsed = z.array(CommentItemSchema).parse(raw);
          // Wire-format translation: server "" → client null. See transforms.ts.
          return parsed.map((item) => ({
            ...item,
            groupId: item.groupId === "" ? null : item.groupId,
          })) as CommentItem[];
        }
        const raw = await response.json();
        const serverItems = z.array(CommentItemSchema).parse(raw);
        return mergeRevealedIntoComments(serverItems);
      } catch (error) {
        return handleError(error);
      }
    },

    upsertComment: async (item: CommentItem): Promise<void> => {
      try {
        const result = await putComment(
          config.workspace,
          item.id,
          toCommentWire(item, config.syncRevealedState),
        );
        expectOk("PUT /comments/:commentId", result.status);
      } catch (error) {
        handleError(error);
      }
    },

    deleteComment: async (commentId: string): Promise<void> => {
      try {
        const result = await removeComment(config.workspace, commentId);
        expectOk("DELETE /comments/:commentId", result.status);
      } catch (error) {
        handleError(error);
      }
    },

    loadGroups: async (): Promise<SelectionGroup[]> => {
      try {
        const response = await fetch(`${baseUrl}/groups`, {
          headers: apiAuthHeaders(),
        });
        if (!response.ok) {
          throw new Error(`GET /groups failed: ${response.status}`);
        }
        if (config.syncRevealedState) {
          const raw = await response.json();
          return z.array(SelectionGroupSchema).parse(raw) as SelectionGroup[];
        }
        const raw = await response.json();
        const serverGroups = z.array(SelectionGroupSchema).parse(raw);
        return mergeRevealedIntoGroups(serverGroups);
      } catch (error) {
        return handleError(error);
      }
    },

    upsertGroup: async (group: SelectionGroup): Promise<void> => {
      try {
        const result = await putGroup(
          config.workspace,
          group.id,
          toGroupWire(group, config.syncRevealedState),
        );
        expectOk("PUT /groups/:groupId", result.status);
      } catch (error) {
        handleError(error);
      }
    },

    deleteGroup: async (groupId: string): Promise<void> => {
      try {
        const result = await removeGroup(config.workspace, groupId);
        expectOk("DELETE /groups/:groupId", result.status);
      } catch (error) {
        handleError(error);
      }
    },

    uploadScreenshot: async (
      selectionId: string,
      type: "full" | "element",
      blob: Blob,
    ): Promise<string> => {
      try {
        const response = await fetch(
          `${baseUrl}/screenshots/${encodeURIComponent(selectionId)}/${type}`,
          {
            method: "PUT",
            body: blob,
            headers: { "Content-Type": blob.type, ...apiAuthHeaders() },
          },
        );
        if (!response.ok) {
          throw new Error(`PUT /screenshots failed: ${response.status}`);
        }
        const raw = await response.json();
        const result = UploadResultSchema.parse(raw);
        return result.key;
      } catch (error) {
        return handleError(error);
      }
    },
  };
};
