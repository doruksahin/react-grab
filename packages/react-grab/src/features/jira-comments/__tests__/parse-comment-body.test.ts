import { describe, it, expect } from "vitest";

import { parseCommentBody } from "../parse-comment-body.js";

describe("parseCommentBody", () => {
  it("returns single text segment for plain text", () => {
    expect(parseCommentBody("hello world")).toEqual([
      { kind: "text", text: "hello world" },
    ]);
  });

  it("parses a markdown image with an absolute URL into an image segment", () => {
    const result = parseCommentBody(
      "before ![alt](https://example.com/img.png) after",
    );
    expect(result).toEqual([
      { kind: "text", text: "before " },
      { kind: "image", alt: "alt", url: "https://example.com/img.png" },
      { kind: "text", text: " after" },
    ]);
  });

  it("turns an image on the sync server into an attachment segment", () => {
    expect(parseCommentBody("![shot.png](/jira-attachment/10042)")).toEqual([
      { kind: "attachment", alt: "shot.png" },
    ]);
  });

  it("parses @Mention into mention segment", () => {
    const result = parseCommentBody("@Salih Doruk Şahin test3");
    expect(result).toEqual([
      { kind: "mention", name: "Salih Doruk Şahin" },
      { kind: "text", text: " test3" },
    ]);
  });

  it("handles mention followed by text without space", () => {
    const result = parseCommentBody("hello @Alice Cooper world");
    expect(result).toEqual([
      { kind: "text", text: "hello " },
      { kind: "mention", name: "Alice Cooper" },
      { kind: "text", text: " world" },
    ]);
  });

  it("handles image and mention in same body", () => {
    const result = parseCommentBody("@Bob Smith ![pic](/a.png) done");
    expect(result).toEqual([
      { kind: "mention", name: "Bob Smith" },
      { kind: "text", text: " " },
      { kind: "attachment", alt: "pic" },
      { kind: "text", text: " done" },
    ]);
  });

  it("does not treat lowercase @ as mention", () => {
    const result = parseCommentBody("email me@test.com");
    expect(result).toEqual([{ kind: "text", text: "email me@test.com" }]);
  });

  it("does not treat single-word @Name as mention", () => {
    const result = parseCommentBody("@Admin check this");
    expect(result).toEqual([{ kind: "text", text: "@Admin check this" }]);
  });
});
