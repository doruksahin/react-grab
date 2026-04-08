import { z } from "zod";
import type { CommentItem } from "../../types.js";
import type { SelectionGroup } from "../selection-groups/types.js";
import type { StorageAdapter, SyncConfig } from "./types.js";
import { CommentItemSchema, SelectionGroupSchema, UploadResultSchema } from "./schemas.js";
import {
  stripRevealedFromComments,
  stripRevealedFromGroups,
  mergeRevealedIntoComments,
  mergeRevealedIntoGroups,
  saveLocalRevealedStates,
} from "./transforms.js";

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
        const response = await fetch(`${baseUrl}/comments`);
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

    persistComments: async (items: CommentItem[]): Promise<CommentItem[]> => {
      // Wire-format translation: client null → server "" (see transforms.ts).
      // stripRevealedFromComments already handles this on the non-sync path.
      const payload = config.syncRevealedState
        ? items.map((i) => ({ ...i, groupId: i.groupId === null ? "" : i.groupId }))
        : stripRevealedFromComments(items);
      if (!config.syncRevealedState) {
        saveLocalRevealedStates(items, []);
      }
      try {
        const response = await fetch(`${baseUrl}/comments`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(`PUT /comments failed: ${response.status}`);
        }
        return items;
      } catch (error) {
        return handleError(error);
      }
    },

    loadGroups: async (): Promise<SelectionGroup[]> => {
      try {
        const response = await fetch(`${baseUrl}/groups`);
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

    persistGroups: async (groups: SelectionGroup[]): Promise<SelectionGroup[]> => {
      const payload = config.syncRevealedState
        ? groups
        : stripRevealedFromGroups(groups);
      if (!config.syncRevealedState) {
        saveLocalRevealedStates([], groups);
      }
      try {
        const response = await fetch(`${baseUrl}/groups`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(`PUT /groups failed: ${response.status}`);
        }
        return groups;
      } catch (error) {
        return handleError(error);
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
            headers: { "Content-Type": blob.type },
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
