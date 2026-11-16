import { describe, expect, it } from "vitest";
import { rewriteAttachmentLinks } from "../jira-attachment-links.js";

const path = (id: string) => `/workspaces/ws/groups/g/jira-attachments/${id}`;

describe("rewriteAttachmentLinks (ADR-0027)", () => {
  it("maps Jira's own attachment URL to the ticket's proxy path", () => {
    expect(
      rewriteAttachmentLinks(
        "see ![shot.png](https://acme.atlassian.net/rest/api/3/attachment/content/10042)",
        path,
      ),
    ).toBe("see ![shot.png](/workspaces/ws/groups/g/jira-attachments/10042)");
  });

  it("keeps images posted before ADR-0027 working", () => {
    expect(rewriteAttachmentLinks("![a](/jira-attachment/7)", path)).toBe(
      "![a](/workspaces/ws/groups/g/jira-attachments/7)",
    );
  });

  it("leaves other images alone", () => {
    const markdown = "![x](https://example.com/x.png) ![y](media://abc)";
    expect(rewriteAttachmentLinks(markdown, path)).toBe(markdown);
  });
});
