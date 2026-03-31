import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const DATA_DIR = join(process.cwd(), "data", "workspaces");

const workspacePath = (workspaceId: string): string =>
  join(DATA_DIR, workspaceId);

const ensureWorkspaceDir = async (workspaceId: string): Promise<void> => {
  const dir = workspacePath(workspaceId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
};

export const readJsonFile = async <T>(
  workspaceId: string,
  filename: string,
  defaultValue: T,
): Promise<T> => {
  const filePath = join(workspacePath(workspaceId), filename);
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return defaultValue;
  }
};

export const writeJsonFile = async <T>(
  workspaceId: string,
  filename: string,
  data: T,
): Promise<void> => {
  await ensureWorkspaceDir(workspaceId);
  const filePath = join(workspacePath(workspaceId), filename);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
};
