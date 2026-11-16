import type { Component } from "solid-js";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../ui/menu.js";
import { IconEllipsis } from "../icons/icon-ellipsis.jsx";
import { IconTrash } from "../icons/icon-trash.jsx";

interface SelectionCardMenuProps {
  /** Shown only when the membership policy allows it (ADR-0008). */
  onRemove: () => void;
}

/**
 * The card's less frequent actions. Removing sits here, away from the
 * header, so it is never mistaken for closing the card.
 */
export const SelectionCardMenu: Component<SelectionCardMenuProps> = (props) => (
  <Menu modal={false} placement="bottom-end" gutter={4}>
    <MenuTrigger
      data-react-grab-ignore-events
      data-react-grab-selection-card-menu
      variant="icon"
      aria-label="Selection actions"
      class="-mt-0.5 -mr-1 shrink-0"
      onClick={(event: MouseEvent) => event.stopPropagation()}
    >
      <IconEllipsis size={14} />
    </MenuTrigger>
    <MenuContent class="min-w-[10rem]">
      <MenuItem
        data-react-grab-selection-remove
        tone="destructive"
        onSelect={props.onRemove}
      >
        <IconTrash size={12} />
        Remove selection
      </MenuItem>
    </MenuContent>
  </Menu>
);
