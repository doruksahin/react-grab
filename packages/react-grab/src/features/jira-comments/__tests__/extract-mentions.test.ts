import { describe, it, expect } from "vitest";
import { extractMentions } from "../extract-mentions.js";

describe("extractMentions", () => {
  it("returns empty array when no mentions", () => {
    const json = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }] };
    expect(extractMentions(json)).toEqual([]);
  });

  it("extracts mention with accountId and display name", () => {
    const json = {
      type: "doc",
      content: [{
        type: "paragraph",
        content: [
          { type: "mention", attrs: { id: "abc", label: "Alice Cooper" } },
          { type: "text", text: " hi" },
        ],
      }],
    };
    expect(extractMentions(json)).toEqual([{ text: "@Alice Cooper", accountId: "abc" }]);
  });

  it("deduplicates mentions", () => {
    const json = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "mention", attrs: { id: "a1", label: "Alice" } }] },
        { type: "paragraph", content: [{ type: "mention", attrs: { id: "a1", label: "Alice" } }] },
      ],
    };
    expect(extractMentions(json)).toHaveLength(1);
  });
});
