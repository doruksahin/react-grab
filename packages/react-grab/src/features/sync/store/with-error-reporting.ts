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
  const reported =
    <Args extends unknown[], Result>(
      call: (...args: Args) => Promise<Result>,
    ) =>
    async (...args: Args): Promise<Result> => {
      try {
        return await call(...args);
      } catch (error) {
        const reportedError = toError(error);
        onSyncError(reportedError);
        throw reportedError;
      }
    };

  return {
    loadComments: reported(storage.loadComments),
    upsertComment: reported(storage.upsertComment),
    deleteComment: reported(storage.deleteComment),
    loadGroups: reported(storage.loadGroups),
    upsertGroup: reported(storage.upsertGroup),
    deleteGroup: reported(storage.deleteGroup),
    uploadScreenshot: reported(storage.uploadScreenshot),
    // A screenshot that fails to show leaves an empty slot; it is not a sync failure.
    loadScreenshot: storage.loadScreenshot,
    uploadRecording: reported(storage.uploadRecording),
  };
};
