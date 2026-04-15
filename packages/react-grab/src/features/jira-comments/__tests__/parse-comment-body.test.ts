import { describe, it, expect, vi } from "vitest";

vi.mock("../../../generated/custom-fetch.js", () => ({
  getApiBaseUrl: () => "http://localhost:8787",
}));

import { parseCommentBody } from "../parse-comment-body.js";

describe("parseCommentBody", () => {
  it("returns single text segment for plain text", () => {
    expect(parseCommentBody("hello world")).toEqual([
      { kind: "text", text: "hello world" },
    ]);
  });

  it("parses markdown image into image segment", () => {
    const result = parseCommentBody("before ![alt](/img.png) after");
    expect(result).toEqual([
      { kind: "text", text: "before " },
      { kind: "image", alt: "alt", url: "http://localhost:8787/img.png" },
      { kind: "text", text: " after" },
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
      { kind: "image", alt: "pic", url: "http://localhost:8787/a.png" },
      { kind: "text", text: " done" },
    ]);
  });

  it("does not treat lowercase @ as mention", () => {
    const result = parseCommentBody("email me@test.com");
    expect(result).toEqual([
      { kind: "text", text: "email me@test.com" },
    ]);
  });

  it("does not treat single-word @Name as mention", () => {
    const result = parseCommentBody("@Admin check this");
    expect(result).toEqual([
      { kind: "text", text: "@Admin check this" },
    ]);
  });
});
