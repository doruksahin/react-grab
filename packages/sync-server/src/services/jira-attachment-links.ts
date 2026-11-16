/** Maps an attachment id to the proxy path the overlay loads it from. */
export type AttachmentPath = (attachmentId: string) => string;

/**
 * An image a comment links by attachment id: Jira's own content URL, which
 * uploadBase64Images writes, or the proxy path that versions before ADR-0027
 * wrote into Jira (`/jira-attachment/<id>`).
 */
const ATTACHMENT_LINK =
  /!\[([^\]]*)\]\((?:\/jira-attachment\/|https:\/\/[^/\s)]+\/rest\/api\/3\/attachment\/content\/)(\d+)\)/g;

/** Points every attachment image of a comment at the ticket's proxy path. */
export const rewriteAttachmentLinks = (
  markdown: string,
  attachmentPath: AttachmentPath,
): string =>
  markdown.replace(
    ATTACHMENT_LINK,
    (_match, alt: string, attachmentId: string) =>
      `![${alt}](${attachmentPath(attachmentId)})`,
  );
