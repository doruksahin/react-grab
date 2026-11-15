import { For, Show, onMount, onCleanup } from "solid-js";
import type { Component } from "solid-js";
import type { SelectionGroup } from "../../features/selection-groups/types.js";
import { registerOverlayDismiss } from "../../utils/register-overlay-dismiss.js";
import { cn } from "../../utils/cn.js";
import { IconCheck } from "../icons/icon-check.jsx";
import { ActionList, ActionListItem } from "../ui/action-list.js";

interface GroupRow {
  id: string | null;
  name: string;
}

interface GroupPickerFlyoutProps {
  groups: SelectionGroup[];
  /** If set, renders a checkmark on this group (label picker context). */
  activeGroupId?: string | null;
  /** If set, this group is hidden from the list (move context). */
  excludeGroupId?: string;
  onSelect: (groupId: string | null) => void;
  onClose: () => void;
  /** If provided, renders a "New group..." inline input at the bottom. */
  onAddGroup?: (name: string) => void;
  /** Opening direction. Defaults to "bottom" (drops down). */
  placement?: "bottom" | "top";
}

export const GroupPickerFlyout: Component<GroupPickerFlyoutProps> = (props) => {
  onMount(() => {
    const unregister = registerOverlayDismiss({
      isOpen: () => true,
      onDismiss: props.onClose,
    });
    onCleanup(unregister);
  });

  const visibleGroups = () =>
    props.groups.filter((g) => g.id !== props.excludeGroupId);

  // "Ungrouped" (groupId null) is the first row; every row renders the same way.
  const rows = (): GroupRow[] => [
    { id: null, name: "Ungrouped" },
    ...visibleGroups().map((group) => ({ id: group.id, name: group.name })),
  ];

  const header = () =>
    props.excludeGroupId !== undefined ? "Move to group" : "Add to group";

  return (
    <div
      data-react-grab-ignore-events
      class="absolute left-0 z-50 bg-popover text-popover-foreground rounded-[10px] overflow-hidden w-[180px] [font-synthesis:none] [corner-shape:superellipse(1.25)] shadow-md"
      classList={{
        "top-full mt-1": props.placement !== "top",
        "bottom-full mb-1": props.placement === "top",
      }}
    >
      <div class="px-2 pt-1.5 pb-1">
        <span class="text-meta font-medium text-muted-foreground">
          {header()}
        </span>
      </div>
      <ActionList label="Groups" class="border-t border-border py-1">
        <For each={rows()}>
          {(row) => {
            const isActive = () => row.id === (props.activeGroupId ?? null);
            return (
              <ActionListItem
                data-react-grab-ignore-events
                class="gap-2"
                aria-pressed={isActive()}
                onClick={(event) => {
                  event.stopPropagation();
                  props.onSelect(row.id);
                }}
              >
                <IconCheck
                  size={10}
                  class={cn(
                    "shrink-0 text-muted-foreground",
                    !isActive() && "invisible",
                  )}
                />
                <span
                  class={cn(
                    "text-caption",
                    isActive()
                      ? "font-medium text-popover-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {row.name}
                </span>
              </ActionListItem>
            );
          }}
        </For>
      </ActionList>
      <Show when={props.onAddGroup}>
        <div class="border-t border-border px-2 py-1.5">
          <div class="flex items-center gap-1.5">
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              class="text-muted-foreground/50 shrink-0"
            >
              <path
                fill="currentColor"
                fill-rule="evenodd"
                d="M7.25 8.75V15h1.5V8.75H15v-1.5H8.75V1h-1.5v6.25H1v1.5z"
                clip-rule="evenodd"
              />
            </svg>
            <input
              data-react-grab-ignore-events
              type="text"
              placeholder="New group..."
              aria-label="New group name"
              class="flex-1 text-caption bg-transparent outline-none placeholder:text-muted-foreground/50 text-popover-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value.trim()) {
                  props.onAddGroup?.(e.currentTarget.value.trim());
                  e.currentTarget.value = "";
                }
              }}
            />
          </div>
        </div>
      </Show>
    </div>
  );
};
