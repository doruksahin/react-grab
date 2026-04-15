import { Version3Client, AgileClient } from "jira.js";
import { markdownToAdf } from "marklassian";
import { convertADFToMarkdown, type ADFDocument } from "adf-to-markdown";
import type { SyncRepository, ScreenshotStore } from "../repositories/types.js";


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
  labels?: string[];
}

interface CreateTicketResult {
  jiraTicketId: string;
  jiraUrl: string;
}

interface JiraCommentNode {
  commentId: string;
  threadParentId: string | null;
  created: string;
  author: { name?: string | null; picture?: string | null } | null;
  richText: { adfValue: { json: ADFDocument } } | null;
  childComments?: { edges: Array<{ node: JiraCommentNode }> } | null;
}

interface ThreadedComment {
  id: string;
  parentId: string | null;
  author: string;
  authorAvatar: string | null;
  body: string;
  createdAt: string;
}

export class JiraService {
  private client: Version3Client;
  private agileClient: AgileClient;
  private config: JiraConfig;
  private cloudIdPromise: Promise<string> | null = null;

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
    this.agileClient = new AgileClient({
      host: config.baseUrl,
      authentication: {
        basic: { email: config.email, apiToken: config.apiToken },
      },
    });
  }

  private get authHeader(): string {
    return `Basic ${btoa(`${this.config.email}:${this.config.apiToken}`)}`;
  }

  private getCloudId(): Promise<string> {
    if (!this.cloudIdPromise) {
      this.cloudIdPromise = fetch(`${this.config.baseUrl}/_edge/tenant_info`)
        .then((r) => r.json() as Promise<{ cloudId: string }>)
        .then((j) => j.cloudId);
    }
    return this.cloudIdPromise;
  }

  /**
   * Fetches Jira comments via the undocumented Atlassian GraphQL gateway so
   * we can retrieve real threading (`threadParentId`, `childComments`).
   *
   * The public REST v3 API flattens replies into top-level comments with no
   * parent reference, so there is no alternative if we want thread fidelity.
   */
  /**
   * Streams a Jira attachment binary from the REST content endpoint using the
   * service's stored basic-auth credentials. Returns the upstream Response so
   * the caller can forward body + headers.
   */
  async fetchAttachmentContent(attachmentId: string): Promise<Response> {
    return fetch(
      `${this.config.baseUrl}/rest/api/3/attachment/content/${encodeURIComponent(attachmentId)}`,
      {
        headers: { Authorization: this.authHeader },
        redirect: "follow",
      },
    );
  }

  private rewriteMediaUrls(
    markdown: string,
    filenameToAttachmentId: Map<string, string>,
  ): string {
    // adf-to-markdown emits `![alt](media://{fileId})` for Jira media nodes.
    // Jira's public REST attachment API is keyed by attachmentId, not the
    // Media API fileId in the ADF body — but `alt` matches `attachment.filename`
    // when an image is uploaded into a comment (Jira auto-attaches to the issue).
    // Resolve via filename match, rewrite to our sync-server proxy path.
    return markdown.replace(
      /!\[([^\]]*)\]\(media:\/\/([^)]+)\)/g,
      (match, alt: string, _fileId: string) => {
        const attachmentId = filenameToAttachmentId.get(alt);
        if (!attachmentId) return match; // leave as-is if we can't resolve
        return `![${alt}](/jira-attachment/${attachmentId})`;
      },
    );
  }

  private async fetchThreadedComments(
    ticketId: string,
    filenameToAttachmentId: Map<string, string>,
  ): Promise<ThreadedComment[]> {
    const cloudId = await this.getCloudId();
    const query = `query JiraComments($cloudId: ID!, $key: String!) {
      jira {
        issueByKey(cloudId: $cloudId, key: $key) {
          comments(first: 100, rootCommentsOnly: true) {
            edges {
              node {
                ...CommentFields
                childComments(first: 100) {
                  edges { node { ...CommentFields } }
                }
              }
            }
          }
        }
      }
    }
    fragment CommentFields on JiraPlatformComment {
      commentId
      threadParentId
      created
      author { name picture }
      richText { adfValue { json } }
    }`;
    const response = await fetch(
      "https://appier.atlassian.net/gateway/api/graphql",
      {
        method: "POST",
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operationName: "JiraComments",
          query,
          variables: { cloudId, key: ticketId },
        }),
      },
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      data?: {
        jira?: {
          issueByKey?: {
            comments?: { edges: Array<{ node: JiraCommentNode }> };
          };
        };
      };
    };
    const rootEdges =
      payload.data?.jira?.issueByKey?.comments?.edges ?? [];

    const flat: ThreadedComment[] = [];
    const pushNode = (node: JiraCommentNode, parentId: string | null) => {
      const rawMarkdown = node.richText?.adfValue?.json
        ? convertADFToMarkdown(node.richText.adfValue.json).trim()
        : "";
      const body = this.rewriteMediaUrls(rawMarkdown, filenameToAttachmentId);
      flat.push({
        id: node.commentId,
        parentId: parentId ?? node.threadParentId ?? null,
        author: node.author?.name ?? "Unknown",
        authorAvatar: node.author?.picture ?? null,
        body,
        createdAt: node.created,
      });
      for (const child of node.childComments?.edges ?? []) {
        pushNode(child.node, node.commentId);
      }
    };
    for (const edge of rootEdges) pushNode(edge.node, null);
    return flat;
  }

  async createTicketFromGroup(
    params: CreateTicketParams,
    workspaceId: string,
    groupId: string,
    repo: SyncRepository,
    screenshots: ScreenshotStore,
  ): Promise<CreateTicketResult> {
    // Idempotency: bail early if group already has a ticket
    const allGroups = await repo.listGroups(workspaceId);
    const existingGroup = allGroups.find((g) => g.id === groupId);
    if (existingGroup?.jiraTicketId) {
      return {
        jiraTicketId: existingGroup.jiraTicketId,
        jiraUrl: `${this.config.baseUrl}/browse/${existingGroup.jiraTicketId}`,
      };
    }

    // 1. Load comments for this group (used for screenshot attachments below)
    const comments = await repo.listComments(workspaceId);
    const groupComments = comments.filter((c) => c.groupId === groupId);

    const descriptionText = markdownToAdf(params.description);

    // 3. Create the issue
    const issue = await this.client.issues.createIssue({
      fields: {
        project: { key: params.projectKey },
        summary: params.summary,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: descriptionText as any,
        issuetype: { name: params.issueType },
        priority: { name: params.priority },
        labels: params.labels ?? [],
      },
    });

    const ticketId = issue.key;
    if (!ticketId) throw new Error("Jira createIssue returned no issue key");
    const ticketUrl = `${this.config.baseUrl}/browse/${ticketId}`;

    // 4. Attach screenshots
    for (const comment of groupComments) {
      for (const type of ["element", "full"] as const) {
        const key = type === "element" ? comment.screenshotElement : comment.screenshotFullPage;
        if (!key) continue;

        const screenshot = await screenshots.get(key);
        if (!screenshot) continue;

        // Read the stream into a blob
        const chunks: Uint8Array[] = [];
        const reader = screenshot.body.getReader();
        let done = false;
        while (!done) {
          const result = await reader.read();
          if (result.value) chunks.push(result.value);
          done = result.done;
        }
        const blob = new Blob(chunks as BlobPart[], { type: screenshot.contentType });

        // Use raw fetch instead of jira.js for attachments —
        // jira.js sets a custom Content-Type on FormData which
        // conflicts with Cloudflare Workers' fetch implementation.
        const form = new FormData();
        form.append("file", blob, `${comment.id}-${type}.png`);

        const authHeader = "Basic " + btoa(`${this.config.email}:${this.config.apiToken}`);
        const attachResponse = await fetch(
          `${this.config.baseUrl}/rest/api/3/issue/${ticketId}/attachments`,
          {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "X-Atlassian-Token": "no-check",
            },
            body: form,
          },
        );
        if (!attachResponse.ok) {
          console.error(`Failed to attach ${type} screenshot for ${comment.id}: ${attachResponse.status}`);
        }
      }
    }

    // 5. Update group in D1 (wrap separately to detect partial failure)
    try {
      await repo.updateGroupJira(workspaceId, groupId, ticketId);
    } catch (err) {
      throw new Error(`Jira ticket ${ticketId} created but D1 update failed: ${err}`);
    }

    return { jiraTicketId: ticketId, jiraUrl: ticketUrl };
  }

  async getProjects() {
    const result = await this.client.projects.searchProjects({
      query: "ATT",
    });
    return (result.values ?? [])
      .filter((p) => p.key && p.name)
      .map((p) => ({ key: p.key!, name: p.name! }));
  }

  async getIssueTypes(projectKey: string) {
    const result = await this.client.issues.getCreateIssueMeta({
      projectKeys: [projectKey],
      expand: "projects.issuetypes",
    });
    const project = result.projects?.find((p) => p.key === projectKey);
    return (project?.issuetypes ?? [])
      .filter((t) => !t.subtask && t.id && t.name)
      .map((t) => ({ id: t.id!, name: t.name! }));
  }

  async getPriorities() {
    const priorities = await this.client.issuePriorities.getPriorities();
    return priorities
      .filter((p) => p.id && p.name)
      .map((p) => ({ id: p.id!, name: p.name! }));
  }

  async getLabels(projectKey: string) {
    const result = await this.client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
      jql: `project = ${projectKey} AND labels is not EMPTY`,
      fields: ["labels"],
      maxResults: 100,
    });
    const labelSet = new Set<string>();
    for (const issue of result.issues ?? []) {
      for (const lbl of (issue.fields?.labels as string[] | undefined) ?? []) {
        labelSet.add(lbl);
      }
    }
    return [...labelSet].sort();
  }

  async getIssueStatus(ticketId: string) {
    const issue = await this.client.issues.getIssue({
      issueIdOrKey: ticketId,
      fields: ["status", "assignee", "reporter", "labels", "attachment"],
    });

    // Map filename → attachment id so fetchThreadedComments can rewrite
    // `media://{fileId}` markdown links to our proxy path.
    const attachments =
      (issue.fields.attachment as
        | Array<{ id?: string; filename?: string }>
        | undefined) ?? [];
    const filenameToAttachmentId = new Map<string, string>();
    for (const a of attachments) {
      if (a.id && a.filename) filenameToAttachmentId.set(a.filename, a.id);
    }

    const comments = await this.fetchThreadedComments(
      ticketId,
      filenameToAttachmentId,
    );

    let flagged = false;
    let flaggedAt: string | null = null;
    let flaggedBy: string | null = null;
    let flaggedByAvatar: string | null = null;
    try {
      const response = await fetch(
        `${this.config.baseUrl}/rest/agile/1.0/issue/${ticketId}?fields=flagged`,
        {
          headers: {
            Authorization: this.authHeader,
            Accept: "application/json",
          },
        },
      );
      if (response.ok) {
        const data = (await response.json()) as { fields?: { flagged?: boolean } };
        flagged = data.fields?.flagged === true;
      }
    } catch {
      // Agile API may not be available — default to not flagged
    }

    // Fetch flag date from changelog (only when flagged)
    if (flagged) {
      try {
        const changelogIssue = await this.client.issues.getIssue({
          issueIdOrKey: ticketId,
          fields: ["created"],
          expand: "changelog",
        });
        const histories = (changelogIssue as any).changelog?.histories as
          | Array<{
              created: string;
              author?: { displayName?: string; avatarUrls?: Record<string, string> };
              items: Array<{ field: string; toString: string | null }>;
            }>
          | undefined;
        // Find the most recent "Flagged" → "Impediment" changelog entry
        const flagEntry = histories
          ?.filter((h) => h.items.some((i) => i.field === "Flagged" && i.toString === "Impediment"))
          .at(-1);
        flaggedAt = flagEntry?.created ?? (changelogIssue.fields.created as string | undefined) ?? null;
        flaggedBy = flagEntry?.author?.displayName ?? null;
        flaggedByAvatar = flagEntry?.author?.avatarUrls?.['48x48'] ?? null;
      } catch {
        // Changelog unavailable — flag date unknown
      }
    }

    return {
      status: issue.fields.status?.name ?? "Unknown",
      statusCategory: issue.fields.status?.statusCategory?.name ?? "Unknown",
      assignee: issue.fields.assignee?.displayName ?? null,
      reporter: issue.fields.reporter?.displayName ?? null,
      assigneeAvatar: issue.fields.assignee?.avatarUrls?.['48x48'] ?? null,
      reporterAvatar: issue.fields.reporter?.avatarUrls?.['48x48'] ?? null,
      jiraUrl: `${this.config.baseUrl}/browse/${ticketId}`,
      labels: (issue.fields.labels as string[] | undefined) ?? [],
      comments,
      flagged,
      flaggedAt,
      flaggedBy,
      flaggedByAvatar,
    };
  }

  /**
   * Add a comment to a JIRA issue. Supports threaded replies via parentId.
   * Body must be an ADF document — route handler converts markdown first.
   */
  async addComment(
    ticketId: string,
    adf: ReturnType<typeof import("marklassian").markdownToAdf>,
    parentId?: string,
  ): Promise<{ id: string; created: string }> {
    const result = await this.client.issueComments.addComment({
      issueIdOrKey: ticketId,
      comment: adf,
      ...(parentId ? { parentId } : {}),
    });
    return {
      id: result.id ?? "",
      created: result.created ?? new Date().toISOString(),
    };
  }

  /**
   * Extract base64 data: URLs from markdown, upload to JIRA as attachments,
   * and replace with proxy URLs. Returns rewritten markdown.
   */
  async uploadBase64Images(ticketId: string, body: string): Promise<string> {
    const imgRegex = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;
    let processed = body;
    for (const match of body.matchAll(imgRegex)) {
      const [full, alt, dataUrl] = match;
      const base64 = dataUrl!.split(",")[1];
      if (!base64) continue;
      const mimeType = dataUrl!.match(/data:([^;]+)/)?.[1] ?? "image/png";
      const ext = mimeType.split("/")[1] ?? "png";
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: mimeType });
      const form = new FormData();
      form.append("file", blob, `comment-${Date.now()}.${ext}`);
      const authHeader = "Basic " + btoa(`${this.config.email}:${this.config.apiToken}`);
      const attachRes = await fetch(
        `${this.config.baseUrl}/rest/api/3/issue/${ticketId}/attachments`,
        {
          method: "POST",
          headers: { Authorization: authHeader, "X-Atlassian-Token": "no-check" },
          body: form,
        },
      );
      if (attachRes.ok) {
        const attachments = (await attachRes.json()) as Array<{ id: string }>;
        if (attachments[0]) {
          processed = processed.replace(full!, `![${alt}](/jira-attachment/${attachments[0].id})`);
        }
      }
    }
    return processed;
  }

  /**
   * Search for JIRA users that can be mentioned in comments.
   * Uses the user picker endpoint which returns users with accountId needed for ADF mentions.
   */
  async searchUsers(query: string, projectKey?: string): Promise<Array<{ accountId: string; displayName: string; avatarUrl: string | null }>> {
    const results = await this.client.userSearch.findAssignableUsers({
      query,
      project: projectKey,
      maxResults: 10,
    });
    return (results ?? []).map((u) => ({
      accountId: u.accountId ?? "",
      displayName: u.displayName ?? "Unknown",
      avatarUrl: u.avatarUrls?.["48x48"] ?? null,
    }));
  }

}
