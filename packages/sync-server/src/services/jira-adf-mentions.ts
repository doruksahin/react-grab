interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
  marks?: unknown[];
  [key: string]: unknown;
}

interface MentionMapping {
  text: string;      // e.g. "@Alice Cooper"
  accountId: string; // JIRA accountId
}

/**
 * Walks an ADF tree and replaces @Name text patterns with mention nodes.
 * Pure function — no side effects, no dependencies on JiraService.
 */
export function injectMentions(
  adf: AdfNode,
  mentions: MentionMapping[],
): AdfNode {
  if (mentions.length === 0) return adf;
  return walkNode(structuredClone(adf), mentions);
}

function walkNode(node: AdfNode, mentions: MentionMapping[]): AdfNode {
  if (!node.content) return node;
  const expanded: AdfNode[] = [];
  for (const child of node.content) {
    if (child.type === "text" && child.text) {
      expanded.push(...splitTextNode(child, mentions));
    } else {
      expanded.push(walkNode(child, mentions));
    }
  }
  node.content = expanded;
  return node;
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
