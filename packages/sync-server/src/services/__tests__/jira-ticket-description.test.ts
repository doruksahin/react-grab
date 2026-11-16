import { describe, expect, it } from "vitest";
import type { ADFEntity } from "@atlaskit/adf-utils/types";
import { markdownToAdf } from "marklassian";
import {
  buildTicketDescription,
  type TicketDescriptionInput,
} from "../jira-ticket-description.js";
import { adfError, assertValidAdf } from "../adf-validation.js";
import { JiraError } from "../jira-errors.js";

type DescriptionComment = TicketDescriptionInput["comments"][number];

const RECORDING_URL =
  "https://sync.example.com/r/6f1c2d3e-4a5b-4c6d-8e7f-001122334455";

const fullComment: DescriptionComment = {
  content:
    '<svg class="w-full">\n  (17 elements)\n</svg>\n  in iG\n  in iK\n  /src/canvas/Icon.tsx:42',
  elementName: "svg",
  tagName: "svg",
  componentName: "iG",
  elementSelectors: [".relative > svg", "svg"],
  commentText: "The icon is cut off",
  pageUrl: "https://app.example.com/",
  pageTitle: "Cognograph",
  recordingUrl: RECORDING_URL,
  steps: [
    { type: "navigate", url: "https://app.example.com/" },
    {
      type: "click",
      selectors: ['[data-layout="regular"]'],
      offsetX: 1,
      offsetY: 1,
    },
    {
      type: "click",
      selectors: ['aria/Save[role="button"]'],
      offsetX: 1,
      offsetY: 1,
      assertedEvents: [
        { type: "navigation", url: "https://app.example.com/done" },
      ],
    },
  ],
};

const bareComment: DescriptionComment = {
  content: "<div>Plain</div>",
  elementName: "div",
  tagName: "div",
};

const build = (
  input: Partial<TicketDescriptionInput> &
    Pick<TicketDescriptionInput, "comments">,
) => {
  const description = buildTicketDescription({
    groupName: null,
    note: [],
    ...input,
  });
  expect(adfError(description)).toBeUndefined();
  return description;
};

const types = (nodes: ADFEntity[]): string[] => nodes.map((node) => node.type);

const findAll = (node: ADFEntity, type: string): ADFEntity[] => {
  const own = node.type === type ? [node] : [];
  const children = (node.content ?? []).flatMap((child) =>
    child ? findAll(child, type) : [],
  );
  return [...own, ...children];
};

const textOf = (node: ADFEntity): string =>
  findAll(node, "text")
    .map((textNode) => textNode.text ?? "")
    .join("");

describe("buildTicketDescription", () => {
  it("orders the parts of a selection with every field", () => {
    const description = build({ comments: [fullComment] });
    expect(types(description.content)).toEqual([
      "heading",
      "panel",
      "heading",
      "panel",
      "orderedList",
      "heading",
      "table",
      "expand",
    ]);
    const [title, comment, , recording, steps, , where, context] =
      description.content;
    expect(textOf(title)).toBe("iG <svg>");
    expect(comment.attrs).toEqual({ panelType: "note" });
    expect(recording.attrs).toEqual({ panelType: "info" });
    expect(findAll(recording, "text")[0].marks).toEqual([
      { type: "link", attrs: { href: RECORDING_URL } },
    ]);
    expect(steps.content).toHaveLength(3);
    expect(textOf(where)).toContain("/src/canvas/Icon.tsx:42");
    expect(context.attrs).toEqual({ title: "Context for coding agents" });
    expect(findAll(context, "codeBlock")[0].attrs).toEqual({
      language: "html",
    });
    expect(textOf(context)).toBe(fullComment.content);
  });

  it("leaves out the steps section without steps or a recording", () => {
    const description = build({ comments: [bareComment] });
    expect(types(description.content)).toEqual(["heading", "expand"]);
  });

  it("shows a recording without steps", () => {
    const description = build({
      comments: [{ ...fullComment, steps: undefined }],
    });
    expect(types(description.content).slice(2, 5)).toEqual([
      "heading",
      "panel",
      "heading",
    ]);
    expect(findAll(description, "orderedList")).toHaveLength(0);
  });

  it("shows steps without a recording", () => {
    const description = build({
      comments: [{ ...fullComment, recordingUrl: undefined }],
    });
    expect(types(description.content).slice(2, 4)).toEqual([
      "heading",
      "orderedList",
    ]);
    expect(findAll(description, "panel")).toHaveLength(1);
  });

  it("numbers two selections and puts a rule between them", () => {
    const description = build({ comments: [fullComment, bareComment] });
    const headings = description.content.filter(
      (node) => node.type === "heading" && node.attrs?.level === 2,
    );
    expect(headings.map(textOf)).toEqual(["1. iG <svg>", "2. div <div>"]);
    expect(findAll(description, "rule")).toHaveLength(1);
  });

  it("names a group that is not synthetic", () => {
    const description = build({
      groupName: "Checkout",
      comments: [bareComment],
    });
    const [groupLine] = description.content;
    expect(textOf(groupLine)).toBe("Group: Checkout");
    expect(findAll(groupLine, "text")[1].marks).toEqual([{ type: "strong" }]);
  });

  it("leaves out the group line for a synthetic group", () => {
    const description = build({ comments: [bareComment] });
    expect(description.content[0].type).toBe("heading");
  });

  it("puts the note first", () => {
    const note = markdownToAdf("Happens only on **Safari**.").content;
    const description = build({ note, comments: [bareComment] });
    expect(description.content[0]).toEqual(note[0]);
    expect(description.content[1].type).toBe("heading");
  });

  it("never links a page address that is not http or https", () => {
    const description = build({
      comments: [{ ...bareComment, pageUrl: "javascript:alert(1)" }],
    });
    const pageText = findAll(description, "table").flatMap((tableNode) =>
      findAll(tableNode, "text"),
    );
    expect(pageText.some((node) => node.text === "javascript:alert(1)")).toBe(
      true,
    );
    expect(
      pageText.every((node) => !node.marks?.some((m) => m.type === "link")),
    ).toBe(true);
  });

  it("keeps markdown characters in text as they are", () => {
    const commentText = "*not bold* [not a link](x) # not a heading";
    const description = build({ comments: [{ ...bareComment, commentText }] });
    expect(textOf(description.content[1])).toBe(commentText);
  });

  it("puts a CSS selector target in code, and quotes a named one", () => {
    const description = build({ comments: [fullComment] });
    const [, cssClick, namedClick] = findAll(description, "listItem");
    const cssTarget = findAll(cssClick, "text")[1];
    expect(cssTarget).toEqual({
      type: "text",
      text: '[data-layout="regular"]',
      marks: [{ type: "code" }],
    });
    const namedTexts = findAll(namedClick, "text");
    expect(namedTexts[1]).toEqual({ type: "text", text: "“Save”" });
    expect(textOf(namedClick)).toBe("Click “Save” (button) → /done");
  });
});

describe("assertValidAdf", () => {
  it("throws a typed error for an invalid document", () => {
    const invalid = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "x",
              marks: [{ type: "code" }, { type: "strong" }],
            },
          ],
        },
      ],
    };
    expect(adfError(invalid)).toBeDefined();
    expect(() => assertValidAdf(invalid)).toThrowError(JiraError);
  });
});
