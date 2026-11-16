import type { StorageAdapter } from "../types.js";

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

/**
 * Reports failed storage calls to `onSyncError`, then rethrows them so the
 * caller still sees the failure.
 */
export const withErrorReporting = (
  storage: StorageAdapter,
  onSyncError: (error: Error) => void,
): StorageAdapter => {
  const reported = async <Result>(
    call: () => Promise<Result>,
  ): Promise<Result> => {
    try {
      return await call();
    } catch (error) {
      const reportedError = toError(error);
      onSyncError(reportedError);
      throw reportedError;
    }
  };

  return {
    loadComments: () => reported(() => storage.loadComments()),
    upsertComment: (item) => reported(() => storage.upsertComment(item)),
    deleteComment: (commentId) =>
      reported(() => storage.deleteComment(commentId)),
    loadGroups: () => reported(() => storage.loadGroups()),
    upsertGroup: (group) => reported(() => storage.upsertGroup(group)),
    deleteGroup: (groupId) => reported(() => storage.deleteGroup(groupId)),
    uploadScreenshot: (selectionId, kind, blob) =>
      reported(() => storage.uploadScreenshot(selectionId, kind, blob)),
    // A screenshot that fails to show leaves an empty slot; it is not a sync failure.
    loadScreenshot: (selectionId, kind) =>
      storage.loadScreenshot(selectionId, kind),
    uploadRecording: (commentId, gzipBlob) =>
      reported(() => storage.uploadRecording(commentId, gzipBlob)),
  };
};
