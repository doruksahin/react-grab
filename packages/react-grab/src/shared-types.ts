// Types shared by src/types.ts and the feature type modules. This is the
// lowest type layer: it imports nothing from src/types.ts or features/.
import type { ServerCommentItem } from "./generated/types.js";

export interface OverlayBounds {
  borderRadius: string;
  height: number;
  transform: string;
  width: number;
  x: number;
  y: number;
}

/**
 * CommentItem extends the server-defined shape with UI-only fields.
 * Server fields come from Orval (SSOT: sync-server Zod schemas).
 * UI-only fields are added here.
 *
 * `groupId` is overridden to `string | null` (server type is `string`).
 * `null` = intentionally ungrouped. The wire-format translation
 * (`null` ↔ `""`) lives in features/sync/transforms.ts.
 */
export interface CommentItem extends Omit<ServerCommentItem, "groupId"> {
  groupId: string | null;
  previewBounds?: OverlayBounds[];
}
