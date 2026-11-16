import {
  code,
  codeBlock,
  doc,
  expand,
  heading,
  link,
  listItem,
  orderedList,
  panel,
  paragraph,
  rule,
  strong,
  table,
  tableCell,
  tableRow,
  text,
} from "@atlaskit/adf-utils/builders";
import { PanelType } from "@atlaskit/adf-schema/panel";
import type { TextDefinition } from "@atlaskit/adf-schema/text";
import type { ADFEntity } from "@atlaskit/adf-utils/types";
import { describeStepParts, extractFilePath } from "@react-grab/selection-text";
import { markdownToAdf } from "marklassian";
import type { Comment } from "../repositories/types.js";

/**
 * The Jira ticket description as ADF (ADR-0029, SPEC-021). Pure: it reads the
 * rows the server already has and returns the document Jira stores.
 */

const RECORDING_HINT = "The last 5–10 minutes before this comment.";
const CODE_LANGUAGE = "html";
const WEB_PROTOCOLS = new Set(["http:", "https:"]);

type DescriptionComment = Pick<
  Comment,
  | "content"
  | "elementName"
  | "tagName"
  | "componentName"
  | "elementSelectors"
  | "commentText"
  | "pageUrl"
  | "pageTitle"
  | "recordingUrl"
  | "steps"
>;

export interface TicketDescriptionInput {
  /** The group's name, or null for a synthetic group, which has none to show. */
  groupName: string | null;
  comments: DescriptionComment[];
  /** The reporter's note, already converted to ADF; empty when there is none. */
  note: ADFEntity[];
}

export interface TicketDescription {
  version: 1;
  type: "doc";
  content: ADFEntity[];
}

type Block = Parameters<typeof doc>[number];
type MarkBuilder = typeof code;

/** A mark builder returns a loose type; a string input always gives a text node. */
const isTextNode = (node: ReturnType<MarkBuilder>): node is TextDefinition =>
  node.type === "text" && typeof node.text === "string";

const marked = (mark: MarkBuilder, value: string): TextDefinition => {
  const node = mark(value);
  if (!isTextNode(node)) throw new Error("Expected a text node from a mark");
  return node;
};

const codeText = (value: string): TextDefinition => marked(code, value);
const strongText = (value: string): TextDefinition => marked(strong, value);

const isWebUrl = (url: string): boolean =>
  URL.canParse(url) && WEB_PROTOCOLS.has(new URL(url).protocol);

/** Linked text for a web URL; plain text for anything else, so it cannot run. */
const linkedText = (label: string, url: string): TextDefinition =>
  isWebUrl(url) ? marked(link({ href: url }), label) : text(label);

const nonEmptyLines = (value: string): string[] =>
  value.split("\n").filter((line) => line.trim().length > 0);

const titleOf = (
  comment: DescriptionComment,
  index: number,
  numbered: boolean,
): Block => {
  const name = comment.componentName || comment.elementName;
  const prefix = numbered ? `${index + 1}. ` : "";
  return heading({ level: 2 })(
    text(`${prefix}${name} `),
    codeText(`<${comment.tagName}>`),
  );
};

const commentPanel = (commentText: string): Block | undefined => {
  const lines = nonEmptyLines(commentText);
  if (lines.length === 0) return undefined;
  return panel({ panelType: PanelType.NOTE })(
    ...lines.map((line) => paragraph(text(line))),
  );
};

const recordingPanel = (recordingUrl: string): Block =>
  panel({ panelType: PanelType.INFO })(
    paragraph(
      linkedText("Watch the recording", recordingUrl),
      text(` — ${RECORDING_HINT}`),
    ),
  );

const stepItem = (step: NonNullable<Comment["steps"]>[number]) => {
  const { verb, target, targetKind, detail, destination } =
    describeStepParts(step);
  const targetNode =
    targetKind === "name" ? text(`“${target}”`) : codeText(target);
  const tail = [detail ? ` ${detail}` : "", destination ? ` → ` : ""].join("");
  const inline: TextDefinition[] = [text(`${verb} `), targetNode];
  if (tail) inline.push(text(tail));
  if (destination) inline.push(codeText(destination));
  return listItem([paragraph(...inline)]);
};

const stepsSection = (comment: DescriptionComment): Block[] => {
  const steps = comment.steps ?? [];
  if (steps.length === 0 && !comment.recordingUrl) return [];
  const blocks: Block[] = [heading({ level: 3 })(text("Steps to reproduce"))];
  if (comment.recordingUrl) blocks.push(recordingPanel(comment.recordingUrl));
  if (steps.length > 0) blocks.push(orderedList()(...steps.map(stepItem)));
  return blocks;
};

const whereRow = (label: string, value: TextDefinition) =>
  tableRow([
    tableCell()(paragraph(strongText(label))),
    tableCell()(paragraph(value)),
  ]);

const whereSection = (comment: DescriptionComment): Block[] => {
  const rows = [];
  if (comment.pageUrl) {
    rows.push(
      whereRow(
        "Page",
        linkedText(comment.pageTitle || comment.pageUrl, comment.pageUrl),
      ),
    );
  }
  const filePath = extractFilePath(comment.content);
  if (filePath) {
    const line = filePath.line === null ? "" : `:${filePath.line}`;
    rows.push(whereRow("File", codeText(`${filePath.path}${line}`)));
  }
  const selector = comment.elementSelectors?.[0];
  if (selector) rows.push(whereRow("Selector", codeText(selector)));
  if (rows.length === 0) return [];
  return [heading({ level: 3 })(text("Where")), table(...rows)];
};

const agentContext = (content: string): Block | undefined => {
  if (content.trim().length === 0) return undefined;
  return expand({ title: "Context for coding agents" })(
    codeBlock({ language: CODE_LANGUAGE })(text(content)),
  );
};

const selectionBlocks = (
  comment: DescriptionComment,
  index: number,
  numbered: boolean,
): Block[] =>
  [
    titleOf(comment, index, numbered),
    comment.commentText ? commentPanel(comment.commentText) : undefined,
    ...stepsSection(comment),
    ...whereSection(comment),
    agentContext(comment.content),
  ].filter((block): block is Block => block !== undefined);

export const buildTicketDescription = ({
  groupName,
  comments,
  note,
}: TicketDescriptionInput): TicketDescription => {
  const numbered = comments.length > 1;
  const blocks: Block[] = [];
  if (groupName !== null) {
    blocks.push(paragraph(text("Group: "), strongText(groupName)));
  }
  comments.forEach((comment, index) => {
    if (index > 0) blocks.push(rule());
    blocks.push(...selectionBlocks(comment, index, numbered));
  });
  return {
    version: 1,
    type: "doc",
    content: [...note, ...doc(...blocks).content],
  };
};

export interface TicketDescriptionRequest {
  note?: string;
  /** Deprecated: the whole description, from a client built before ADR-0029. */
  description?: string;
}

/**
 * The description Jira gets. A client built before ADR-0029 sends the whole
 * description as markdown and no note; it keeps today's conversion.
 */
export const ticketDescriptionFor = (
  request: TicketDescriptionRequest,
  build: Omit<TicketDescriptionInput, "note">,
): TicketDescription => {
  if (request.note === undefined && request.description !== undefined) {
    return markdownToAdf(request.description);
  }
  const note = request.note?.trim() ? markdownToAdf(request.note).content : [];
  return buildTicketDescription({ ...build, note });
};
