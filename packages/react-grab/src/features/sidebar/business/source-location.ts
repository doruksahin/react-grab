import { extractFilePath } from "../extract-file-path.js";

/** "path:line" of the source file in a selection's content, or undefined. */
export const sourceLocation = (content: string): string | undefined => {
  const filePath = extractFilePath(content);
  if (!filePath) return undefined;
  return filePath.line !== null
    ? `${filePath.path}:${filePath.line}`
    : filePath.path;
};
