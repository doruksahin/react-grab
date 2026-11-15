import { describe, it, expect } from "vitest";
import { defaultDescription, defaultSummary } from "./jira-defaults.js";
import type { SelectionGroup } from "../selection-groups/types.js";
import type { CommentItem } from "../../types.js";

const group: SelectionGroup = {
  id: "group-1",
  name: "Billing",
  createdAt: 0,
  revealed: false,
};

const makeItem = (overrides: Partial<CommentItem> = {}): CommentItem => ({
  id: "comment-1",
  groupId: "group-1",
  content: "<span>$12</span>",
  elementName: "PriceLabel",
  tagName: "span",
  commentText: "Price label overlaps the badge",
  timestamp: 0,
  ...overrides,
});

describe("defaultDescription page link (S5.6)", () => {
  it("links the page title to the page URL", () => {
    const description = defaultDescription(group, [
      makeItem({
        pageUrl: "https://app.example.com/settings/billing",
        pageTitle: "Billing settings",
      }),
    ]);

    expect(description).toContain(
      "- **Page:** [Billing settings](https://app.example.com/settings/billing)",
    );
  });

  it("puts the page line after the comment and before the selector", () => {
    const description = defaultDescription(group, [
      makeItem({
        pageUrl: "https://app.example.com/settings/billing",
        pageTitle: "Billing settings",
        elementSelectors: ["[data-testid='price']"],
      }),
    ]);

    const commentIndex = description.indexOf(
      "> Price label overlaps the badge",
    );
    const pageIndex = description.indexOf("- **Page:**");
    const selectorIndex = description.indexOf("- **Selector:**");
    expect(commentIndex).toBeLessThan(pageIndex);
    expect(pageIndex).toBeLessThan(selectorIndex);
  });

  it("uses the URL as link text when the page has no title", () => {
    const description = defaultDescription(group, [
      makeItem({ pageUrl: "https://app.example.com/home", pageTitle: "" }),
    ]);

    expect(description).toContain(
      "- **Page:** [https://app.example.com/home](https://app.example.com/home)",
    );
  });

  it("escapes brackets in the title and parentheses in the URL", () => {
    const description = defaultDescription(group, [
      makeItem({
        pageUrl: "https://app.example.com/p/(draft)",
        pageTitle: "[Draft] Pricing",
      }),
    ]);

    expect(description).toContain(
      "- **Page:** [\\[Draft\\] Pricing](https://app.example.com/p/%28draft%29)",
    );
  });

  it("omits the page line for comments saved before page capture existed", () => {
    const description = defaultDescription(group, [makeItem()]);

    expect(description).not.toContain("**Page:**");
  });

  it("gives each selection its own page line", () => {
    const description = defaultDescription(group, [
      makeItem({
        id: "comment-1",
        pageUrl: "https://app.example.com/a",
        pageTitle: "Page A",
      }),
      makeItem({
        id: "comment-2",
        pageUrl: "https://app.example.com/b",
        pageTitle: "Page B",
      }),
    ]);

    expect(description).toContain("[Page A](https://app.example.com/a)");
    expect(description).toContain("[Page B](https://app.example.com/b)");
  });
});

describe("defaultDescription recording link (SPEC-020)", () => {
  it("links the recording of how the user got there", () => {
    const description = defaultDescription(group, [
      makeItem({
        recordingUrl:
          "https://sync.example.com/r/6f1c2d3e-4a5b-4c6d-8e7f-001122334455",
      }),
    ]);
    expect(description).toContain(
      "- **Recording:** [Watch how we got here](https://sync.example.com/r/6f1c2d3e-4a5b-4c6d-8e7f-001122334455)",
    );
  });

  it("adds no recording line when there is no recording", () => {
    expect(defaultDescription(group, [makeItem()])).not.toContain(
      "**Recording:**",
    );
  });
});

describe("defaultSummary (ADR-0022 step 3, S5.1)", () => {
  const loose: SelectionGroup = {
    ...group,
    name: "PriceLabel",
    synthetic: true,
  };

  it("keeps the name of a group the user named", () => {
    expect(defaultSummary(group, [makeItem()])).toBe("Billing");
  });

  it("starts a loose selection's summary from its comment", () => {
    expect(defaultSummary(loose, [makeItem()])).toBe(
      "Price label overlaps the badge",
    );
  });

  it("uses the first non-empty line, with spaces collapsed", () => {
    expect(
      defaultSummary(loose, [
        makeItem({
          commentText: "\n  Checkout   button does nothing\nOn Safari",
        }),
      ]),
    ).toBe("Checkout button does nothing");
  });

  it("cuts a long comment at a word boundary", () => {
    const summary = defaultSummary(loose, [
      makeItem({ commentText: "word ".repeat(40) }),
    ]);
    expect(summary.length).toBeLessThanOrEqual(80);
    expect(summary.endsWith("word…")).toBe(true);
  });

  it("falls back to the group name without comment text", () => {
    expect(defaultSummary(loose, [makeItem({ commentText: "  " })])).toBe(
      "PriceLabel",
    );
  });
});
