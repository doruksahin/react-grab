import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import type { JiraUserSuggestion } from "../../../features/jira-comments/types.js";
import { getCachedUsers, setCachedUsers } from "../../../features/jira-comments/mention-cache.js";
import { initials, avatarColor } from "../../../features/jira-comments/avatar-utils.js";
import { useShadowMount } from "../../../utils/shadow-context.js";

export function createMentionSuggestion(
  searchFn?: (query: string) => Promise<JiraUserSuggestion[]>,
): Omit<SuggestionOptions, "editor"> {
  return {
    items: async ({ query }) => {
      if (!searchFn || query.length < 1) return [];
      const cached = getCachedUsers(query);
      if (cached) return cached;
      const users = await searchFn(query);
      setCachedUsers(query, users);
      return users;
    },
    render: () => {
      let popup: HTMLDivElement | null = null;
      let selected = 0;
      let items: JiraUserSuggestion[] = [];
      let commandFn: SuggestionProps["command"] | null = null;

      function renderList() {
        if (!popup) return;
        popup.innerHTML = items
          .map(
            (u, i) =>
              `<div class="mention-item${i === selected ? " active" : ""}" data-index="${i}">
                <div class="avatar" style="background:${avatarColor(u.displayName)};width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0">${initials(u.displayName)}</div>
                <span class="name" style="font-size:12px">${u.displayName}</span>
              </div>`,
          )
          .join("");
      }

      function selectItem(index: number) {
        const item = items[index];
        if (item && commandFn) {
          commandFn({ id: item.accountId, label: item.displayName });
        }
      }

      return {
        onStart(props: SuggestionProps) {
          popup = document.createElement("div");
          popup.className = "mention-picker-popup";
          popup.setAttribute("data-react-grab-mention-picker", "");
          popup.setAttribute("data-react-grab-ignore-events", "");
          popup.style.pointerEvents = "auto";
          popup.addEventListener("mousedown", (e) => {
            e.preventDefault();
            const el = (e.target as HTMLElement).closest("[data-index]");
            if (el) selectItem(Number(el.getAttribute("data-index")));
          });

          items = props.items as JiraUserSuggestion[];
          commandFn = props.command;
          selected = 0;
          renderList();

          const { decorationNode } = props as SuggestionProps & { decorationNode: HTMLElement | null };
          if (decorationNode) {
            const rect = decorationNode.getBoundingClientRect();
            popup.style.position = "fixed";
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.bottom + 4}px`;
            popup.style.zIndex = "9999";
          }

          // Mount inside shadow DOM — same pattern as Kobalte portals
          const mount = useShadowMount();
          mount.appendChild(popup);
        },
        onUpdate(props: SuggestionProps) {
          items = props.items as JiraUserSuggestion[];
          commandFn = props.command;
          selected = 0;
          renderList();

          const { decorationNode } = props as SuggestionProps & { decorationNode: HTMLElement | null };
          if (popup && decorationNode) {
            const rect = decorationNode.getBoundingClientRect();
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.bottom + 4}px`;
          }
        },
        onKeyDown(props: { event: KeyboardEvent }) {
          if (props.event.key === "ArrowDown") {
            selected = (selected + 1) % items.length;
            renderList();
            return true;
          }
          if (props.event.key === "ArrowUp") {
            selected = (selected - 1 + items.length) % items.length;
            renderList();
            return true;
          }
          if (props.event.key === "Enter" || props.event.key === "Tab") {
            selectItem(selected);
            return true;
          }
          if (props.event.key === "Escape") {
            popup?.remove();
            popup = null;
            return true;
          }
          return false;
        },
        onExit() {
          popup?.remove();
          popup = null;
        },
      };
    },
  };
}
