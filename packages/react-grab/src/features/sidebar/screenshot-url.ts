/**
 * Constructs the URL to fetch a screenshot from the sync server.
 *
 * screenshotElement and screenshotFullPage on CommentItem are R2 storage key
 * strings — NOT base64 data URIs. The server serves them at:
 *   GET ${serverUrl}/workspaces/${workspace}/screenshots/${selectionId}/${type}
 *
 * selectionId is CommentItem.id.
 * type: 'element' | 'full'
 */
export function screenshotUrl(
  serverUrl: string,
  workspace: string,
  selectionId: string,
  type: "element" | "full",
): string {
  return (
    `${serverUrl}/workspaces/${encodeURIComponent(workspace)}` +
    `/screenshots/${encodeURIComponent(selectionId)}/${type}`
  );
}
