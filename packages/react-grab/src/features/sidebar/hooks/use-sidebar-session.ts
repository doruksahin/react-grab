import { createSignal } from "solid-js";

/** Opens the sidebar on one selection; a new object for every request. */
export interface SidebarFocusRequest {
  itemId: string;
}

export interface SidebarSessionAPI {
  isOpen: () => boolean;
  /** The latest "open on this selection" request, null when opened plainly. */
  focusRequest: () => SidebarFocusRequest | null;
  /** Opens the sidebar; `returnFocusTo` gets focus back when it closes. */
  open: (returnFocusTo?: HTMLElement | null) => void;
  /** Opens the sidebar on a selection, e.g. from a label's "Open thread". */
  openOnItem: (itemId: string, returnFocusTo?: HTMLElement | null) => void;
  toggle: (returnFocusTo?: HTMLElement | null) => void;
  /** Closes the sidebar and returns focus to what opened it. */
  close: () => void;
}

/** Whether the sidebar is open, what it opens on, and where focus returns. */
export const useSidebarSession = (): SidebarSessionAPI => {
  const [isOpen, setIsOpen] = createSignal(false);
  const [focusRequest, setFocusRequest] =
    createSignal<SidebarFocusRequest | null>(null);
  let returnFocusTarget: HTMLElement | null = null;

  const open = (returnFocusTo?: HTMLElement | null) => {
    returnFocusTarget = returnFocusTo ?? null;
    setFocusRequest(null);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setFocusRequest(null);
    const target = returnFocusTarget;
    returnFocusTarget = null;
    if (target?.isConnected) target.focus();
  };

  return {
    isOpen,
    focusRequest,
    open,
    openOnItem: (itemId, returnFocusTo) => {
      returnFocusTarget = returnFocusTo ?? null;
      setFocusRequest({ itemId });
      setIsOpen(true);
    },
    toggle: (returnFocusTo) => (isOpen() ? close() : open(returnFocusTo)),
    close,
  };
};
