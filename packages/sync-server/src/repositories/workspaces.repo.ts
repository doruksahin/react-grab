import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema.js";
import type { Workspace, WorkspaceRepository } from "./types.js";

type Database = DrizzleD1Database<typeof schema>;

const workspaceColumns = {
  id: schema.workspaces.id,
  jiraAccountId: schema.workspaces.jiraAccountId,
  jiraProjectKey: schema.workspaces.jiraProjectKey,
};

export class D1WorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<Workspace[]> {
    return this.db
      .select(workspaceColumns)
      .from(schema.workspaces)
      .orderBy(schema.workspaces.id);
  }

  async find(id: string): Promise<Workspace | undefined> {
    const [row] = await this.db
      .select(workspaceColumns)
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, id))
      .limit(1);
    return row;
  }

  async ensure(id: string): Promise<void> {
    await this.db
      .insert(schema.workspaces)
      .values({ id, createdAt: Date.now() })
      .onConflictDoNothing();
  }

  async setDestination(
    id: string,
    jiraAccountId: string,
    jiraProjectKey: string,
  ): Promise<void> {
    await this.db
      .insert(schema.workspaces)
      .values({ id, jiraAccountId, jiraProjectKey, createdAt: Date.now() })
      .onConflictDoUpdate({
        target: schema.workspaces.id,
        set: { jiraAccountId, jiraProjectKey },
      });
  }

  async clearDestination(id: string): Promise<void> {
    await this.db
      .update(schema.workspaces)
      .set({ jiraAccountId: null, jiraProjectKey: null })
      .where(eq(schema.workspaces.id, id));
  }
}
