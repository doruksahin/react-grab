import type { markdownToAdf } from "marklassian";

type AdfDocument = ReturnType<typeof markdownToAdf>;
type AdfNode = AdfDocument["content"][number];

interface MentionMapping {
  text: string;      // e.g. "@Alice Cooper"
  accountId: string; // JIRA accountId
}

/**
 * Walks an ADF tree and replaces @Name text patterns with mention nodes.
 * Pure function — no side effects, no dependencies on JiraService.
 */
export function injectMentions(
  adf: AdfDocument,
  mentions: MentionMapping[],
): AdfDocument {
  if (mentions.length === 0) return adf;
  const clone = structuredClone(adf);
  clone.content = walkChildren(clone.content, mentions);
  return clone;
}

function walkChildren(nodes: AdfNode[], mentions: MentionMapping[]): AdfNode[] {
  const result: AdfNode[] = [];
  for (const child of nodes) {
    if (child.type === "text" && child.text) {
      result.push(...splitTextNode(child, mentions));
    } else if (child.content) {
      result.push({ ...child, content: walkChildren(child.content, mentions) });
    } else {
      result.push(child);
    }
  }
  return result;
}

function splitTextNode(node: AdfNode, mentions: MentionMapping[]): AdfNode[] {
  let text = node.text!;
  const result: AdfNode[] = [];

  while (text.length > 0) {
    let earliest = -1;
    let match: MentionMapping | null = null;
    for (const m of mentions) {
      const idx = text.indexOf(m.text);
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx;
        match = m;
      }
    }
    if (match === null || earliest === -1) {
      result.push({ ...node, text });
      break;
    }
    if (earliest > 0) {
      result.push({ ...node, text: text.slice(0, earliest) });
    }
    result.push({
      type: "mention",
      attrs: { id: match.accountId, text: match.text, accessLevel: "" },
    });
    text = text.slice(earliest + match.text.length);
    if (text.length === 0) {
      result.push({ ...node, text: "" });
    }
  }
  return result;
}
