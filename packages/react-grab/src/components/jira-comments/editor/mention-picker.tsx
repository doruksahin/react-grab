import { type Component, For, createSignal } from "solid-js";
import { render } from "solid-js/web";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import type { JiraUserSuggestion } from "../../../features/jira-comments/types.js";
import { getCachedUsers, setCachedUsers } from "../../../features/jira-comments/mention-cache.js";
import { useShadowMount } from "../../../utils/shadow-context.js";
import { Avatar } from "../avatar.js";

/** Position the popup above the cursor (preferred) or below if no room above. */
function positionPopup(popup: HTMLDivElement, rect: DOMRect) {
  popup.style.left = `${rect.left}px`;
  requestAnimationFrame(() => {
    const h = popup.offsetHeight || 200;
    popup.style.top = rect.top >= h + 4
      ? `${rect.top - h - 4}px`
      : `${rect.bottom + 4}px`;
  });
}

const MentionList: Component<{
  items: () => JiraUserSuggestion[];
  selected: () => number;
  onSelect: (index: number) => void;
}> = (props) => (
  <For each={props.items()}>
    {(user, i) => (
      <div
        data-react-grab-mention-option
        data-react-grab-mention-id={user.accountId}
        class={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
          i() === props.selected()
            ? "bg-accent text-accent-foreground"
            : "text-popover-foreground hover:bg-accent/50"
        }`}
        onMouseDown={(e) => {
          e.preventDefault();
          props.onSelect(i());
        }}
      >
        <Avatar name={user.displayName} url={user.avatarUrl} size={22} />
        <span class="text-[12px] truncate">{user.displayName}</span>
      </div>
    )}
  </For>
);

export function createMentionSuggestion(
  searchFn?: (query: string) => Promise<JiraUserSuggestion[]>,
): Omit<SuggestionOptions, "editor"> {
  return {
    items: async ({ query }) => {
      if (!searchFn) return [];
      const cached = getCachedUsers(query);
      if (cached) return cached;
      const users = await searchFn(query);
      setCachedUsers(query, users);
      return users;
    },
    render: () => {
      let popup: HTMLDivElement | null = null;
      let dispose: (() => void) | null = null;
      let commandFn: SuggestionProps["command"] | null = null;

      // Signals bridge TipTap's imperative API → SolidJS reactivity
      const [items, setItems] = createSignal<JiraUserSuggestion[]>([]);
      const [selected, setSelected] = createSignal(0);

      function selectItem(index: number) {
        const item = items()[index];
        if (item && commandFn) {
          commandFn({ id: item.accountId, label: item.displayName });
        }
      }

      return {
        onStart(props: SuggestionProps) {
          popup = document.createElement("div");
          popup.className = "rounded-md border border-border bg-popover shadow-lg p-1 min-w-[200px] max-h-[200px] overflow-y-auto";
          popup.setAttribute("data-react-grab-mention-picker", "");
          popup.setAttribute("data-react-grab-ignore-events", "");
          popup.style.pointerEvents = "auto";
          popup.style.position = "fixed";
          popup.style.zIndex = "9999";

          commandFn = props.command;
          setItems(props.items as JiraUserSuggestion[]);
          setSelected(0);

          // Mount SolidJS component tree into the popup
          dispose = render(
            () => <MentionList items={items} selected={selected} onSelect={selectItem} />,
            popup,
          );

          const mount = useShadowMount();
          mount.appendChild(popup);

          const { decorationNode } = props as SuggestionProps & { decorationNode: HTMLElement | null };
          if (decorationNode) {
            positionPopup(popup, decorationNode.getBoundingClientRect());
          }
        },
        onUpdate(props: SuggestionProps) {
          commandFn = props.command;
          setItems(props.items as JiraUserSuggestion[]);
          setSelected(0);

          const { decorationNode } = props as SuggestionProps & { decorationNode: HTMLElement | null };
          if (popup && decorationNode) {
            positionPopup(popup, decorationNode.getBoundingClientRect());
          }
        },
        onKeyDown(props: { event: KeyboardEvent }) {
          const len = items().length;
          if (props.event.key === "ArrowDown") {
            setSelected((s) => (s + 1) % len);
            return true;
          }
          if (props.event.key === "ArrowUp") {
            setSelected((s) => (s - 1 + len) % len);
            return true;
          }
          if (props.event.key === "Enter" || props.event.key === "Tab") {
            selectItem(selected());
            return true;
          }
          if (props.event.key === "Escape") {
            dispose?.();
            popup?.remove();
            popup = null;
            dispose = null;
            return true;
          }
          return false;
        },
        onExit() {
          dispose?.();
          popup?.remove();
          popup = null;
          dispose = null;
        },
      };
    },
  };
}
