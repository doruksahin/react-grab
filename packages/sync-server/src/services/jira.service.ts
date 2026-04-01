import { Version3Client } from "jira.js";
import type { SyncRepository } from "../repositories/types.js";
import type { ScreenshotStore } from "../repositories/types.js";

interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

interface CreateTicketParams {
  projectKey: string;
  issueType: string;
  priority: string;
  summary: string;
  description: string;
}

interface CreateTicketResult {
  jiraTicketId: string;
  jiraUrl: string;
}

export class JiraService {
  private client: Version3Client;
  private config: JiraConfig;

  constructor(config: JiraConfig) {
    this.config = config;
    this.client = new Version3Client({
      host: config.baseUrl,
      authentication: {
        basic: {
          email: config.email,
          apiToken: config.apiToken,
        },
      },
    });
  }

  async createTicketFromGroup(
    params: CreateTicketParams,
    workspaceId: string,
    groupId: string,
    repo: SyncRepository,
    screenshots: ScreenshotStore,
  ): Promise<CreateTicketResult> {
    // 1. Load comments for this group
    const comments = await repo.listComments(workspaceId);
    const groupComments = comments.filter((c) => c.groupId === groupId);

    // 2. Build description — jira.js auto-converts plain text to ADF
    const descriptionText = this.buildDescription(params.description, groupComments);

    // 3. Create the issue
    const issue = await this.client.issues.createIssue({
      fields: {
        project: { key: params.projectKey },
        summary: params.summary,
        description: descriptionText,
        issuetype: { name: params.issueType },
        priority: { name: params.priority },
        labels: ["react-grab"],
      },
    });

    const ticketId = issue.key!;
    const ticketUrl = `${this.config.baseUrl}/browse/${ticketId}`;

    // 4. Attach screenshots
    for (const comment of groupComments) {
      for (const type of ["element", "full"] as const) {
        const key = type === "element" ? comment.screenshotElement : comment.screenshotFullPage;
        if (!key) continue;

        const screenshot = await screenshots.get(key);
        if (!screenshot) continue;

        // Read the stream into a buffer
        const chunks: Uint8Array[] = [];
        const reader = screenshot.body.getReader();
        let done = false;
        while (!done) {
          const result = await reader.read();
          if (result.value) chunks.push(result.value);
          done = result.done;
        }
        const buffer = Buffer.concat(chunks);

        await this.client.issueAttachments.addAttachment({
          issueIdOrKey: ticketId,
          attachment: {
            filename: `${comment.id}-${type}.png`,
            file: buffer,
          },
        });
      }
    }

    // 5. Update group in D1
    await repo.updateGroupJira(workspaceId, groupId, ticketId);

    return { jiraTicketId: ticketId, jiraUrl: ticketUrl };
  }

  async getProjects() {
    const result = await this.client.projects.searchProjects();
    return result.values?.map((p) => ({
      key: p.key!,
      name: p.name!,
    })) ?? [];
  }

  async getIssueTypes(projectKey: string) {
    const types = await this.client.issueTypes.getIssueAllTypes();
    return types.map((t) => ({
      id: t.id!,
      name: t.name!,
    }));
  }

  async getPriorities() {
    const priorities = await this.client.issuePriorities.getPriorities();
    return priorities.map((p) => ({
      id: p.id!,
      name: p.name!,
    }));
  }

  async getIssueStatus(ticketId: string) {
    const issue = await this.client.issues.getIssue({
      issueIdOrKey: ticketId,
      fields: ["status"],
    });
    return {
      status: issue.fields.status?.name ?? "Unknown",
      statusCategory: issue.fields.status?.statusCategory?.name ?? "Unknown",
    };
  }

  private buildDescription(
    userDescription: string,
    comments: Array<{ id: string; componentName?: string; elementName: string; tagName: string; commentText?: string; elementSelectors?: string[] }>,
  ): string {
    let desc = userDescription + "\n\n---\n\n";
    desc += "## Selections\n\n";
    comments.forEach((c, i) => {
      desc += `### ${i + 1}. ${c.componentName ?? c.elementName} <${c.tagName}>\n`;
      if (c.commentText) desc += `${c.commentText}\n`;
      if (c.elementSelectors?.[0]) desc += `Selector: \`${c.elementSelectors[0]}\`\n`;
      desc += "\n";
    });
    desc += "\n_Created by react-grab dashboard_";
    return desc;
  }
}
