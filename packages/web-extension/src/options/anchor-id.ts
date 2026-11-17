export type AnchorKind = "workspace" | "jira-account";

/** The id of a table row, so another row can link to it with `#id`. */
export const anchorId = (kind: AnchorKind, key: string): string =>
  `${kind}-${encodeURIComponent(key)}`;

export const anchorHref = (kind: AnchorKind, key: string): string =>
  `#${anchorId(kind, key)}`;
