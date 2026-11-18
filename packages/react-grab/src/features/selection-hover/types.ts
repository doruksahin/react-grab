export interface SelectionHoverAPI {
  /** Shows the selection's element on the page; null clears it. */
  hover: (itemId: string | null) => void;
}

export interface SelectionHoverHandlers {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}
