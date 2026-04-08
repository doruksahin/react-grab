// packages/react-grab/src/components/sidebar/loose-selection-card-header.tsx
import type { Component, JSX } from 'solid-js';

interface LooseSelectionCardHeaderProps {
  /** Left slot — status pill + timestamp. */
  left: JSX.Element;
  /** Right slot — create-ticket button or ticket link. */
  right: JSX.Element;
}

/**
 * Layout shell for the loose-selection card header row.
 * Slot pattern: caller owns the content, this owns the layout contract
 * (left-aligned meta vs right-aligned action).
 */
export const LooseSelectionCardHeader: Component<
  LooseSelectionCardHeaderProps
> = (props) => {
  return (
    <div class="flex items-center justify-between gap-2 mb-1.5">
      <div class="flex items-center gap-2 min-w-0">{props.left}</div>
      <div class="flex flex-col items-end gap-2 shrink-0">{props.right}</div>
    </div>
  );
};
