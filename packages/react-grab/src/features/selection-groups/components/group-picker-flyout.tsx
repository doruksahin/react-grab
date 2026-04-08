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
      class="absolute left-0 top-full mt-1 z-50 bg-white rounded-[10px] overflow-hidden w-[180px] [font-synthesis:none] [corner-shape:superellipse(1.25)] filter-[drop-shadow(0px_1px_2px_#51515140)]"
    >
      <div class="px-2 pt-1.5 pb-1">
        <span class="text-[11px] font-medium text-black/40">{header()}</span>
      </div>
      <div class="border-t border-[#D9D9D9] py-1">
        {/* Ungrouped row — selecting it sets groupId to null */}
        <button
          data-react-grab-ignore-events
          class="w-full flex items-center gap-2 px-2 py-1 hover:bg-black/[0.03] cursor-pointer text-left"
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
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-black/50 shrink-0"
            >
              <path d="m5 12 5 5L20 7" />
            </svg>
          </Show>
          <span
            class={
              props.activeGroupId == null
                ? "text-[12px] font-medium text-black"
                : "text-[12px] text-black/70"
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
                class="w-full flex items-center gap-2 px-2 py-1 hover:bg-black/[0.03] cursor-pointer text-left"
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
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-black/50 shrink-0"
                  >
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                </Show>
                <span
                  class={
                    isActive()
                      ? "text-[12px] font-medium text-black"
                      : "text-[12px] text-black/70"
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
        <div class="border-t border-[#D9D9D9] px-2 py-1.5">
          <div class="flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-black/25 shrink-0"><path d="M12 5v14m-7-7h14"/></svg>
            <input
              data-react-grab-ignore-events
              type="text"
              placeholder="New group..."
              class="flex-1 text-[12px] bg-transparent outline-none placeholder:text-black/25 text-black"
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
