import { describe, expect, it } from "vitest";
import { latestComment, sentCommentCount } from "../latest-comment.js";
import type { JiraComment } from "../types.js";

const comment = (
  id: string,
  createdAt: string,
  overrides: Partial<JiraComment> = {},
): JiraComment => ({
  id,
  parentId: null,
  author: "Alice",
  authorAvatar: null,
  body: id,
  createdAt,
  ...overrides,
});

describe("latestComment", () => {
  it("is the newest comment by date, whatever the list order", () => {
    expect(
      latestComment([
        comment("b", "2026-01-02T00:00:00Z"),
        comment("c", "2026-01-03T00:00:00Z"),
        comment("a", "2026-01-01T00:00:00Z"),
      ])?.id,
    ).toBe("c");
  });

  it("includes replies", () => {
    expect(
      latestComment([
        comment("top", "2026-01-01T00:00:00Z"),
        comment("reply", "2026-01-02T00:00:00Z", { parentId: "top" }),
      ])?.id,
    ).toBe("reply");
  });

  it("leaves out comments still being sent", () => {
    const comments = [
      comment("sent", "2026-01-01T00:00:00Z"),
      comment("sending", "2026-01-05T00:00:00Z", { sending: true }),
    ];
    expect(latestComment(comments)?.id).toBe("sent");
    expect(sentCommentCount(comments)).toBe(1);
  });

  it("counts an unreadable date as oldest", () => {
    expect(
      latestComment([
        comment("dated", "2026-01-01T00:00:00Z"),
        comment("undated", "not a date"),
      ])?.id,
    ).toBe("dated");
  });

  it("is undefined without comments", () => {
    expect(latestComment([])).toBeUndefined();
  });
});
