interface TipTapNode {
  type: string;
  attrs?: { id?: string; label?: string };
  content?: TipTapNode[];
}

export function extractMentions(
  json: TipTapNode,
): Array<{ text: string; accountId: string }> {
  const seen = new Set<string>();
  const result: Array<{ text: string; accountId: string }> = [];

  function walk(node: TipTapNode) {
    if (node.type === "mention" && node.attrs?.id && node.attrs?.label) {
      if (!seen.has(node.attrs.id)) {
        seen.add(node.attrs.id);
        result.push({ text: `@${node.attrs.label}`, accountId: node.attrs.id });
      }
    }
    for (const child of node.content ?? []) walk(child);
  }

  walk(json);
  return result;
}
