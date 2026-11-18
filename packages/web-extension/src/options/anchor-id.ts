/** The id of the "Enable a site" form, so the popup and the checklist can open it. */
export const ADD_SITE_ANCHOR_ID = "add-site";

export type AnchorKind = "workspace" | "jira-account";

/** The id of a table row, so another row can link to it with `#id`. */
export const anchorId = (kind: AnchorKind, key: string): string =>
  `${kind}-${encodeURIComponent(key)}`;

export const anchorHref = (kind: AnchorKind, key: string): string =>
  `#${anchorId(kind, key)}`;
