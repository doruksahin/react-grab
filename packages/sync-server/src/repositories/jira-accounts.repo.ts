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
const UNIQUE_FAILURE = "UNIQUE constraint failed";

/** D1 names the failed constraint in the message of the error or its causes. */
const isConstraintFailure = (error: unknown, constraint: string): boolean => {
  for (let current = error; current instanceof Error; current = current.cause) {
    if (current.message.includes(constraint)) return true;
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

  async insert(account: JiraAccount): Promise<"inserted" | "duplicate"> {
    // The unique index on site and Jira user decides, so two concurrent adds
    // of the same account cannot both get through.
    const { credential, ...fields } = account;
    try {
      await this.db
        .insert(schema.jiraAccounts)
        .values({ ...fields, ...credentialColumns(credential) });
      return "inserted";
    } catch (error) {
      if (isConstraintFailure(error, UNIQUE_FAILURE)) return "duplicate";
      throw error;
    }
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
      if (isConstraintFailure(error, FOREIGN_KEY_FAILURE)) return "in-use";
      throw error;
    }
  }
}
