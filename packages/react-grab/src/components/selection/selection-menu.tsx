import { type Component, For, Show } from "solid-js";
import type { MoveDestination } from "../../features/selection-groups/business/move-destinations.js";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "../ui/menu.js";
import { ChevronIcon } from "../ui/chevron-icon.jsx";
import { IconEllipsis } from "../icons/icon-ellipsis.jsx";
import { IconFolder } from "../icons/icon-folder.jsx";
import { IconTrash } from "../icons/icon-trash.jsx";
import { IconArchive } from "../icons/icon-archive.jsx";
import { IconRestore } from "../icons/icon-restore.jsx";

export interface MenuAction {
  label: string;
  onSelect: () => void;
}

interface SelectionMenuProps {
  /** Where the selection can move; omitted or empty hides "Move to group". */
  destinations?: MoveDestination[];
  onMove?: (groupId: string | null) => void;
  /** Shown only when the membership policy allows it (ADR-0008). */
  onRemove?: () => void;
  /** Archives the selection's group (ADR-0030); its label says what. */
  archive?: MenuAction;
  /** Restores an archived group or selection to the board. */
  restore?: MenuAction;
  /** Deletes an archived group without a ticket, with its selections. */
  deleteGroup?: MenuAction;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  class?: string;
}

/**
 * A selection's less frequent actions behind ⋯: move it, archive or restore it or its group (ADR-0030), and remove it or delete
 * its archived group. The destructive actions sit here, away from the header
 * and the row, so they are never mistaken for closing.
 */
export const SelectionMenu: Component<SelectionMenuProps> = (props) => {
  const canMove = () => (props.destinations?.length ?? 0) > 0;
  const hasOrganize = () =>
    canMove() || Boolean(props.archive) || Boolean(props.restore);
  const hasDestructive = () =>
    Boolean(props.onRemove) || Boolean(props.deleteGroup);
  // The menu is portaled, but Solid's delegated events still bubble to where
  // it sits in the tree (the row and the panel around it); stop them there.
  const stopBubbling = (event: Event) => event.stopPropagation();

  return (
    <Menu
      modal={false}
      placement="bottom-end"
      gutter={4}
      open={props.open}
      onOpenChange={props.onOpenChange}
    >
      <MenuTrigger
        data-react-grab-ignore-events
        data-react-grab-selection-menu
        variant="icon"
        aria-label="Selection actions"
        class={props.class}
        onPointerDown={(event: PointerEvent) => event.stopPropagation()}
        onClick={(event: MouseEvent) => event.stopPropagation()}
      >
        <IconEllipsis size={14} />
      </MenuTrigger>
      <MenuContent
        data-react-grab-ignore-events
        class="min-w-[11rem]"
        onPointerDown={stopBubbling}
        onClick={stopBubbling}
      >
        <Show when={canMove()}>
          <MenuSub>
            <MenuSubTrigger>
              <span class="flex items-center gap-2">
                <IconFolder size={12} />
                Move to group
              </span>
              <ChevronIcon size={10} class="-rotate-90" />
            </MenuSubTrigger>
            <MenuSubContent
              data-react-grab-ignore-events
              onPointerDown={stopBubbling}
              onClick={stopBubbling}
            >
              <For each={props.destinations}>
                {(destination) => (
                  <MenuItem
                    data-react-grab-move-destination
                    onSelect={() => props.onMove?.(destination.id)}
                  >
                    {destination.name}
                  </MenuItem>
                )}
              </For>
            </MenuSubContent>
          </MenuSub>
        </Show>
        <Show when={props.archive}>
          {(archive) => (
            <MenuItem
              data-react-grab-selection-archive
              onSelect={() => archive().onSelect()}
            >
              <IconArchive size={12} />
              {archive().label}
            </MenuItem>
          )}
        </Show>
        <Show when={props.restore}>
          {(restore) => (
            <MenuItem
              data-react-grab-selection-restore
              onSelect={() => restore().onSelect()}
            >
              <IconRestore size={12} />
              {restore().label}
            </MenuItem>
          )}
        </Show>
        <Show when={hasOrganize() && hasDestructive()}>
          <MenuSeparator class="-mx-1 my-1 border-border" />
        </Show>
        <Show when={props.onRemove}>
          {(onRemove) => (
            <MenuItem
              data-react-grab-selection-remove
              tone="destructive"
              onSelect={() => onRemove()()}
            >
              <IconTrash size={12} />
              Remove selection
            </MenuItem>
          )}
        </Show>
        <Show when={props.deleteGroup}>
          {(deleteGroup) => (
            <MenuItem
              data-react-grab-selection-delete-group
              tone="destructive"
              onSelect={() => deleteGroup().onSelect()}
            >
              <IconTrash size={12} />
              {deleteGroup().label}
            </MenuItem>
          )}
        </Show>
      </MenuContent>
    </Menu>
  );
};
