import {
  MAX_COMMENT_ITEMS,
  MAX_SESSION_STORAGE_SIZE_BYTES,
} from "../constants.js";
import type { CommentItem } from "../types.js";
import { generateId } from "./generate-id.js";
import { logRecoverableError } from "./log-recoverable-error.js";
import type { StorageAdapter } from "../features/sync/types.js";

let activeAdapter: StorageAdapter | null = null;

const COMMENT_ITEMS_KEY = "react-grab-comment-items";
const LEGACY_COMMENT_ITEMS_KEY = "react-grab-history-items";
const CLEAR_CONFIRMED_KEY = "react-grab-clear-confirmed";

const migrateFromLegacyStorage = (): void => {
  try {
    const legacyData = localStorage.getItem(LEGACY_COMMENT_ITEMS_KEY);
    if (legacyData && !localStorage.getItem(COMMENT_ITEMS_KEY)) {
      localStorage.setItem(COMMENT_ITEMS_KEY, legacyData);
    }
    localStorage.removeItem(LEGACY_COMMENT_ITEMS_KEY);
  } catch {
    // HACK: localStorage can throw in private browsing or when quota is exceeded
  }
};

const loadFromLocalStorage = (): CommentItem[] => {
  try {
    const serialized = localStorage.getItem(COMMENT_ITEMS_KEY);
    if (!serialized) return [];
    const parsed = JSON.parse(serialized) as CommentItem[];
    return parsed.map((commentItem) => ({
      ...commentItem,
      groupId:
        typeof commentItem.groupId === "string"
          ? commentItem.groupId
          : "default",
      elementsCount: Math.max(1, commentItem.elementsCount ?? 1),
      previewBounds: commentItem.previewBounds ?? [],
      elementSelectors: commentItem.elementSelectors ?? [],
      revealed: typeof commentItem.revealed === "boolean" ? commentItem.revealed : false,
    }));
  } catch (error) {
    logRecoverableError("Failed to load comments from localStorage", error);
    return [];
  }
};

const readSessionFlag = (key: string): boolean => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

const trimToSizeLimit = (items: CommentItem[]): CommentItem[] => {
  let trimmedItems = items;
  while (trimmedItems.length > 0) {
    const serialized = JSON.stringify(trimmedItems);
    if (new Blob([serialized]).size <= MAX_SESSION_STORAGE_SIZE_BYTES) {
      return trimmedItems;
    }
    trimmedItems = trimmedItems.slice(0, -1);
  }
  return trimmedItems;
};

export const persistCommentItems = (nextItems: CommentItem[]): CommentItem[] => {
  commentItems = activeAdapter ? nextItems : trimToSizeLimit(nextItems);

  if (activeAdapter) {
    activeAdapter.persistComments(commentItems).catch(() => {
      // Error handling is done inside the adapter (calls onSyncError)
    });
  } else {
    try {
      localStorage.setItem(COMMENT_ITEMS_KEY, JSON.stringify(commentItems));
    } catch (error) {
      logRecoverableError("Failed to save comments to localStorage", error);
    }
  }

  return commentItems;
};

migrateFromLegacyStorage();
let commentItems: CommentItem[] = loadFromLocalStorage();
let didConfirmClear = readSessionFlag(CLEAR_CONFIRMED_KEY);

export const initCommentStorage = async (adapter: StorageAdapter): Promise<void> => {
  activeAdapter = adapter;
  const remoteItems = await adapter.loadComments();
  commentItems = remoteItems;
};

export const loadComments = (): CommentItem[] => commentItems;

export const addCommentItem = (
  item: Omit<CommentItem, "id">,
): CommentItem[] =>
  persistCommentItems(
    [{ ...item, id: generateId("comment") }, ...commentItems].slice(
      0,
      MAX_COMMENT_ITEMS,
    ),
  );

export const removeCommentItem = (itemId: string): CommentItem[] =>
  persistCommentItems(
    commentItems.filter((innerItem) => innerItem.id !== itemId),
  );

export const clearComments = (): CommentItem[] => persistCommentItems([]);

export const isClearConfirmed = (): boolean => didConfirmClear;

export const confirmClear = (): void => {
  didConfirmClear = true;
  try {
    localStorage.setItem(CLEAR_CONFIRMED_KEY, "1");
  } catch (error) {
    // HACK: localStorage can throw in private browsing or when quota is exceeded
    logRecoverableError("Failed to save clear preference to localStorage", error);
  }
};
