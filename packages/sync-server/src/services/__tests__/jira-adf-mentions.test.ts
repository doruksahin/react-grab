import { describe, it, expect } from "vitest";
import { injectMentions } from "../jira-adf-mentions.js";

describe("injectMentions", () => {
  it("returns ADF unchanged when no mentions provided", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hello world" }] }],
    };
    expect(injectMentions(adf, [])).toEqual(adf);
  });

  it("replaces @Name with a mention node in a paragraph", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello @Alice Cooper, looks good" }] },
      ],
    };
    const mentions = [{ text: "@Alice Cooper", accountId: "abc123" }];
    const result = injectMentions(adf, mentions);
    const para = result.content![0].content!;
    expect(para).toHaveLength(3);
    expect(para![0]).toEqual({ type: "text", text: "Hello " });
    expect(para![1]).toEqual({
      type: "mention",
      attrs: { id: "abc123", text: "@Alice Cooper", accessLevel: "" },
    });
    expect(para![2]).toEqual({ type: "text", text: ", looks good" });
  });

  it("handles multiple mentions in one text node", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        { type: "paragraph", content: [{ type: "text", text: "@Alice Cooper and @Bob Martinez" }] },
      ],
    };
    const mentions = [
      { text: "@Alice Cooper", accountId: "a1" },
      { text: "@Bob Martinez", accountId: "b2" },
    ];
    const result = injectMentions(adf, mentions);
    const para = result.content![0].content!;
    expect(para).toHaveLength(4);
    expect(para![0]!.type).toBe("mention");
    expect(para![1]).toEqual({ type: "text", text: " and " });
    expect(para![2]!.type).toBe("mention");
    expect(para![3]).toEqual({ type: "text", text: "" }); // trailing empty ok
  });

  it("handles mentions inside nested structures (list items)", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [{
        type: "bulletList",
        content: [{
          type: "listItem",
          content: [{
            type: "paragraph",
            content: [{ type: "text", text: "cc @Alice Cooper" }],
          }],
        }],
      }],
    };
    const mentions = [{ text: "@Alice Cooper", accountId: "a1" }];
    const result = injectMentions(adf, mentions);
    const innerPara = result.content![0]!.content![0]!.content![0]!.content!;
    expect(innerPara![0]).toEqual({ type: "text", text: "cc " });
    expect(innerPara![1]!.type).toBe("mention");
  });

  it("leaves non-text nodes untouched", () => {
    const adf = {
      type: "doc",
      version: 1,
      content: [
        { type: "rule" },
        { type: "paragraph", content: [{ type: "text", text: "no mentions here" }] },
      ],
    };
    const result = injectMentions(adf, [{ text: "@Nobody", accountId: "x" }]);
    expect(result.content![0]).toEqual({ type: "rule" });
    expect(result.content![1]!.content![0]!.text).toBe("no mentions here");
  });
});
