import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema.js";
import type {
  JiraAccount,
  JiraAccountRepository,
  SealedCredential,
} from "./types.js";

type Database = DrizzleD1Database<typeof schema>;
type Row = typeof schema.jiraAccounts.$inferSelect;

const FOREIGN_KEY_FAILURE = "FOREIGN KEY constraint failed";

const isForeignKeyFailure = (error: unknown): boolean => {
  for (let current = error; current instanceof Error; current = current.cause) {
    if (current.message.includes(FOREIGN_KEY_FAILURE)) return true;
  }
  return false;
};

const rowToAccount = (row: Row): JiraAccount => ({
  id: row.id,
  siteUrl: row.siteUrl,
  email: row.email,
  atlassianAccountId: row.atlassianAccountId,
  displayName: row.displayName,
  credential: {
    kind: row.credentialKind,
    ciphertext: row.credentialCiphertext,
    iv: row.credentialIv,
    keyVersion: row.keyVersion,
  },
  createdAt: row.createdAt,
});

const credentialColumns = (credential: SealedCredential) => ({
  credentialKind: credential.kind,
  credentialCiphertext: credential.ciphertext,
  credentialIv: credential.iv,
  keyVersion: credential.keyVersion,
});

export class D1JiraAccountRepository implements JiraAccountRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<JiraAccount[]> {
    const rows = await this.db.select().from(schema.jiraAccounts);
    return rows.map(rowToAccount);
  }

  async find(id: string): Promise<JiraAccount | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.jiraAccounts)
      .where(eq(schema.jiraAccounts.id, id))
      .limit(1);
    return row ? rowToAccount(row) : undefined;
  }

  async findBySiteUser(
    siteUrl: string,
    atlassianAccountId: string,
  ): Promise<JiraAccount | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.jiraAccounts)
      .where(
        and(
          eq(schema.jiraAccounts.siteUrl, siteUrl),
          eq(schema.jiraAccounts.atlassianAccountId, atlassianAccountId),
        ),
      )
      .limit(1);
    return row ? rowToAccount(row) : undefined;
  }

  async insert(account: JiraAccount): Promise<void> {
    const { credential, ...fields } = account;
    await this.db
      .insert(schema.jiraAccounts)
      .values({ ...fields, ...credentialColumns(credential) });
  }

  async updateCredential(
    id: string,
    credential: SealedCredential,
  ): Promise<void> {
    await this.db
      .update(schema.jiraAccounts)
      .set(credentialColumns(credential))
      .where(eq(schema.jiraAccounts.id, id));
  }

  async delete(id: string): Promise<"deleted" | "in-use"> {
    // The foreign keys from workspaces and groups (ON DELETE RESTRICT) decide,
    // so a binding made between a check and the delete cannot slip through.
    try {
      await this.db
        .delete(schema.jiraAccounts)
        .where(eq(schema.jiraAccounts.id, id));
      return "deleted";
    } catch (error) {
      if (isForeignKeyFailure(error)) return "in-use";
      throw error;
    }
  }
}
