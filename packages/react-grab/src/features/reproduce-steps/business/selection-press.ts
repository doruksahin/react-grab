export interface SelectionPress {
  pressStarted: (isSelecting: boolean) => void;
  pressCancelled: () => void;
  /** Whether this click ends a press that selected an element; consumes the press. */
  isSelectionClick: (clickDetail: number) => boolean;
}

/**
 * Remembers whether the current pointer press started while React Grab was
 * selecting (ADR-0025). A selection ends on pointerup, which turns selection
 * mode off before the click fires, so the click is judged by its press.
 * Keyboard clicks (detail 0) have no press and are never selection clicks;
 * a cancelled press (a touch that became a scroll) leaves nothing behind.
 */
export const createSelectionPress = (): SelectionPress => {
  let pressWasSelecting = false;

  return {
    pressStarted: (isSelecting) => {
      pressWasSelecting = isSelecting;
    },
    pressCancelled: () => {
      pressWasSelecting = false;
    },
    isSelectionClick: (clickDetail) => {
      const wasSelecting = pressWasSelecting;
      pressWasSelecting = false;
      return clickDetail > 0 && wasSelecting;
    },
  };
};
