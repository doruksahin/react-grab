import { For, Show, onMount, onCleanup } from "solid-js";
import type { Component } from "solid-js";
import type { SelectionGroup } from "../types.js";
import { registerOverlayDismiss } from "../../../utils/register-overlay-dismiss.js";

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

export const GroupPickerFlyout: Component<GroupPickerFlyoutProps> = (
  props,
) => {
  onMount(() => {
    const unregister = registerOverlayDismiss({
      isOpen: () => true,
      onDismiss: props.onClose,
    });
    onCleanup(unregister);
  });

  const visibleGroups = () =>
    props.groups.filter((g) => g.id !== props.excludeGroupId);

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
        <span class="text-[11px] font-medium text-muted-foreground">{header()}</span>
      </div>
      <div class="border-t border-border py-1">
        {/* Ungrouped row — selecting it sets groupId to null */}
        <button
          data-react-grab-ignore-events
          class="w-full flex items-center gap-2 px-2 py-1 hover:bg-accent cursor-pointer text-left"
          onClick={(e) => {
            e.stopPropagation();
            props.onSelect(null);
          }}
        >
          <Show
            when={props.activeGroupId == null}
            fallback={<span class="w-[10px] shrink-0" />}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              class="text-muted-foreground shrink-0"
            >
              <path fill="currentColor" d="m13.959 3.97-7.25 9a.75.75 0 0 1-1.163.007l-3.5-4.25 1.158-.954 2.914 3.539 6.673-8.283z" />
            </svg>
          </Show>
          <span
            class={
              props.activeGroupId == null
                ? "text-[12px] font-medium text-popover-foreground"
                : "text-[12px] text-muted-foreground"
            }
          >
            Ungrouped
          </span>
        </button>
        <For each={visibleGroups()}>
          {(group) => {
            const isActive = () => group.id === props.activeGroupId;
            return (
              <button
                data-react-grab-ignore-events
                class="w-full flex items-center gap-2 px-2 py-1 hover:bg-accent cursor-pointer text-left"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onSelect(group.id);
                }}
              >
                <Show
                  when={isActive()}
                  fallback={<span class="w-[10px] shrink-0" />}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 16 16"
                    class="text-muted-foreground shrink-0"
                  >
                    <path fill="currentColor" d="m13.959 3.97-7.25 9a.75.75 0 0 1-1.163.007l-3.5-4.25 1.158-.954 2.914 3.539 6.673-8.283z" />
                  </svg>
                </Show>
                <span
                  class={
                    isActive()
                      ? "text-[12px] font-medium text-popover-foreground"
                      : "text-[12px] text-muted-foreground"
                  }
                >
                  {group.name}
                </span>
              </button>
            );
          }}
        </For>
      </div>
      <Show when={props.onAddGroup}>
        <div class="border-t border-border px-2 py-1.5">
          <div class="flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 16 16" class="text-muted-foreground/50 shrink-0"><path fill="currentColor" fill-rule="evenodd" d="M7.25 8.75V15h1.5V8.75H15v-1.5H8.75V1h-1.5v6.25H1v1.5z" clip-rule="evenodd" /></svg>
            <input
              data-react-grab-ignore-events
              type="text"
              placeholder="New group..."
              class="flex-1 text-[12px] bg-transparent outline-none placeholder:text-muted-foreground/50 text-popover-foreground"
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
