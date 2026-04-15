import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import type { JiraUserSuggestion } from "../../../features/jira-comments/types.js";
import { getCachedUsers, setCachedUsers } from "../../../features/jira-comments/mention-cache.js";
import { initials, avatarColor } from "../../../features/jira-comments/avatar-utils.js";
import { useShadowMount } from "../../../utils/shadow-context.js";

function positionPopup(popup: HTMLDivElement, rect: DOMRect) {
  popup.style.left = `${rect.left}px`;
  // Always try above first, fall back to below if no room
  requestAnimationFrame(() => {
    const popupHeight = popup.offsetHeight || 200;
    const spaceAbove = rect.top;
    if (spaceAbove >= popupHeight + 4) {
      popup.style.top = `${rect.top - popupHeight - 4}px`;
    } else {
      popup.style.top = `${rect.bottom + 4}px`;
    }
  });
}

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
                <div class="mention-avatar" style="background:${avatarColor(u.displayName)}">${initials(u.displayName)}</div>
                <span class="mention-name">${u.displayName}</span>
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
          popup.style.position = "fixed";
          popup.style.zIndex = "9999";
          popup.addEventListener("mousedown", (e) => {
            e.preventDefault();
            const el = (e.target as HTMLElement).closest("[data-index]");
            if (el) selectItem(Number(el.getAttribute("data-index")));
          });

          items = props.items as JiraUserSuggestion[];
          commandFn = props.command;
          selected = 0;
          renderList();

          const mount = useShadowMount();
          mount.appendChild(popup);

          const { decorationNode } = props as SuggestionProps & { decorationNode: HTMLElement | null };
          if (decorationNode) {
            positionPopup(popup, decorationNode.getBoundingClientRect());
          }
        },
        onUpdate(props: SuggestionProps) {
          items = props.items as JiraUserSuggestion[];
          commandFn = props.command;
          selected = 0;
          renderList();

          const { decorationNode } = props as SuggestionProps & { decorationNode: HTMLElement | null };
          if (popup && decorationNode) {
            positionPopup(popup, decorationNode.getBoundingClientRect());
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
