import type { z } from "@hono/zod-openapi";
import { markdownToAdf } from "marklassian";
import type {
  ScreenshotStore,
  SyncRepository,
  TicketOrigin,
} from "../repositories/types.js";
import type {
  AddJiraCommentRequest,
  AddJiraCommentResponse,
  CreateJiraTicketRequest,
  CreateJiraTicketResponse,
  JiraIssueType,
  JiraPriority,
  JiraTicketStatus,
  JiraUser,
} from "../schemas/index.js";
import { injectMentions } from "./jira-adf-mentions.js";
import type {
  JiraAccountClient,
  JiraClientFactory,
} from "./jira-client-factory.js";
import { JiraError, withJiraErrors } from "./jira-errors.js";
import type { AttachmentPath } from "./jira.service.js";

type CreateTicketInput = z.infer<typeof CreateJiraTicketRequest>;
type CreateTicketResult = z.infer<typeof CreateJiraTicketResponse>;
type AddCommentInput = z.infer<typeof AddJiraCommentRequest>;
type AddCommentResult = z.infer<typeof AddJiraCommentResponse>;
type TicketStatus = z.infer<typeof JiraTicketStatus>;

export interface JiraTicketServiceDeps {
  repo: SyncRepository;
  screenshots: ScreenshotStore;
  clients: JiraClientFactory;
}

/** Where the overlay loads a ticket attachment from, through the ticket's own account. */
export const ticketAttachmentPath =
  (workspaceId: string, groupId: string): AttachmentPath =>
  (attachmentId) =>
    `/workspaces/${encodeURIComponent(workspaceId)}/groups/${encodeURIComponent(groupId)}/jira-attachments/${encodeURIComponent(attachmentId)}`;

/**
 * A workspace's Jira work through the right account (ADR-0027): new tickets
 * and pickers through the workspace's destination; reading, commenting on and
 * loading attachments of a ticket through the account that created it.
 */
export class JiraTicketService {
  constructor(private readonly deps: JiraTicketServiceDeps) {}

  async createTicket(
    workspaceId: string,
    groupId: string,
    input: CreateTicketInput,
  ): Promise<CreateTicketResult> {
    // Idempotent: a group has at most one ticket, linked through its origin.
    const origin = await this.deps.repo.findTicketOrigin(workspaceId, groupId);
    if (origin) {
      const { jira } = await this.deps.clients.forTicket(origin);
      return {
        jiraTicketId: origin.jiraTicketId,
        jiraUrl: jira.browseUrl(origin.jiraTicketId),
      };
    }
    const destination = await this.deps.clients.forWorkspace(workspaceId);
    return withJiraErrors(
      () =>
        destination.jira.createTicketFromGroup(
          { ...input, projectKey: destination.projectKey },
          workspaceId,
          groupId,
          this.deps.repo,
          this.deps.screenshots,
          destination.accountId,
        ),
      "Failed to create the Jira ticket",
    );
  }

  async getStatus(workspaceId: string, groupId: string): Promise<TicketStatus> {
    const { origin, client } = await this.ticketClient(workspaceId, groupId);
    return withJiraErrors(
      () =>
        client.jira.getIssueStatus(
          origin.jiraTicketId,
          ticketAttachmentPath(workspaceId, groupId),
        ),
      "Failed to read the Jira ticket",
    );
  }

  async addComment(
    workspaceId: string,
    groupId: string,
    { body, parentId, mentions }: AddCommentInput,
  ): Promise<AddCommentResult> {
    const { origin, client } = await this.ticketClient(workspaceId, groupId);
    return withJiraErrors(async () => {
      const processedBody = await client.jira.uploadBase64Images(
        origin.jiraTicketId,
        body,
      );
      const adf = markdownToAdf(processedBody);
      const enriched = mentions?.length ? injectMentions(adf, mentions) : adf;
      return client.jira.addComment(origin.jiraTicketId, enriched, parentId);
    }, "Failed to add the Jira comment");
  }

  async fetchAttachment(
    workspaceId: string,
    groupId: string,
    attachmentId: string,
  ): Promise<Response> {
    const { client } = await this.ticketClient(workspaceId, groupId);
    return client.jira.fetchAttachmentContent(attachmentId);
  }

  async listIssueTypes(
    workspaceId: string,
  ): Promise<z.infer<typeof JiraIssueType>[]> {
    const { jira, projectKey } = await this.deps.clients.forWorkspace(workspaceId);
    return withJiraErrors(
      () => jira.getIssueTypes(projectKey),
      "Failed to list Jira issue types",
    );
  }

  async listPriorities(
    workspaceId: string,
  ): Promise<z.infer<typeof JiraPriority>[]> {
    const { jira } = await this.deps.clients.forWorkspace(workspaceId);
    return withJiraErrors(
      () => jira.getPriorities(),
      "Failed to list Jira priorities",
    );
  }

  async listLabels(
    workspaceId: string,
  ): Promise<string[]> {
    const { jira, projectKey } = await this.deps.clients.forWorkspace(workspaceId);
    return withJiraErrors(
      () => jira.getLabels(projectKey),
      "Failed to list Jira labels",
    );
  }

  async searchUsers(
    workspaceId: string,
    query: string,
  ): Promise<z.infer<typeof JiraUser>[]> {
    const { jira, projectKey } = await this.deps.clients.forWorkspace(workspaceId);
    return withJiraErrors(
      () => jira.searchUsers(query, projectKey),
      "Failed to search Jira users",
    );
  }

  private async ticketClient(
    workspaceId: string,
    groupId: string,
  ): Promise<{ origin: TicketOrigin; client: JiraAccountClient }> {
    const origin = await this.deps.repo.findTicketOrigin(workspaceId, groupId);
    if (!origin) {
      throw new JiraError(
        "jira-ticket-missing",
        "No Jira ticket linked to this group",
      );
    }
    return { origin, client: await this.deps.clients.forTicket(origin) };
  }
}
