import type { Accessor, Setter } from "solid-js";
import type {
  CommentItem,
  OverlayBounds,
  ToolbarState,
} from "../../types.js";

/**
 * Tracking entry for a pinned preview (grabbed box + optional label).
 */
export interface PreviewEntry {
  boxId: string;
  labelId: string | null;
}

/**
 * Dependencies injected from core/index.tsx into the selection visibility module.
 * Explicit interface = explicit boundary. Core owns these; the module borrows them.
 */
export interface SelectionVisibilityDeps {
  /** Reactive signal of all comment items */
  commentItems: Accessor<CommentItem[]>;
  /** Setter for the comment items signal */
  setCommentItems: Setter<CommentItem[]>;
  /** Persist comment items to sessionStorage */
  persistCommentItems: (items: CommentItem[]) => CommentItem[];
  /** Resolve a comment item to its connected DOM elements */
  getConnectedCommentElements: (item: CommentItem) => Element[];
  /** Compute overlay bounds for a DOM element */
  createElementBounds: (element: Element) => OverlayBounds;
  /** Add a preview (grabbed box + label) with tracking */
  addCommentItemPreview: (
    item: CommentItem,
    previewBounds: OverlayBounds[],
    previewElements: Element[],
    idPrefix: string,
    trackingArray: PreviewEntry[],
  ) => void;
  /** Store actions for managing grabbed boxes and labels */
  actions: {
    removeGrabbedBox: (boxId: string) => void;
    removeLabelInstance: (instanceId: string) => void;
  };
  /** Reactive signal of toolbar state */
  currentToolbarState: Accessor<ToolbarState | null>;
  /** Update toolbar state (merges partial updates) */
  updateToolbarState: (updates: Partial<ToolbarState>) => ToolbarState;
}

/**
 * Public API returned by createSelectionVisibility.
 * This is the ONLY way core/index.tsx interacts with the reveal system.
 */
export interface SelectionVisibilityAPI {
  /** Whether the parent toggle is currently ON */
  selectionsRevealed: Accessor<boolean>;
  /** Check if a specific comment item is individually revealed */
  isItemRevealed: (commentItemId: string) => boolean;
  /** Toggle the parent (overrides all children) */
  handleToggleParent: () => void;
  /** Toggle an individual comment item's revealed state */
  handleToggleItem: (commentItemId: string) => void;
  /** Dispose reactive effects (call on cleanup) */
  dispose: () => void;
}
