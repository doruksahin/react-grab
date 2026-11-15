export const getFileName = (filePath: string): string =>
  filePath.split(/[\\/]/).pop() || filePath;
