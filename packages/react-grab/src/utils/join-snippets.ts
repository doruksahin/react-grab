export const joinSnippets = (snippets: string[]): string => {
  if (snippets.length <= 1) return snippets[0] ?? "";

  return snippets
    .map((snippet, index) => `[${index + 1}]\n${snippet}`)
    .join("\n\n");
};

export interface GroupedSnippet {
  groupName: string;
  entries: Array<{
    content: string;
    commentText?: string;
  }>;
}

export const joinGroupedSnippets = (groups: GroupedSnippet[]): string => {
  // Filter out empty groups
  const nonEmpty = groups.filter((g) => g.entries.length > 0);
  if (nonEmpty.length === 0) return "";

  // Single item across all groups — no header, no numbering
  const totalEntries = nonEmpty.reduce((n, g) => n + g.entries.length, 0);
  if (totalEntries === 1) {
    const entry = nonEmpty[0]!.entries[0]!;
    if (entry.commentText) {
      return `${entry.commentText}\n\n${entry.content}`;
    }
    return entry.content;
  }

  const multiGroup = nonEmpty.length > 1;
  let index = 1;
  const parts: string[] = [];

  for (const group of nonEmpty) {
    if (multiGroup) {
      parts.push(`## ${group.groupName}`);
    }
    for (const entry of group.entries) {
      const prefix = entry.commentText ? `[${index}] ${entry.commentText}` : `[${index}]`;
      parts.push(`${prefix}\n${entry.content}`);
      index++;
    }
  }

  return parts.join("\n\n");
};
