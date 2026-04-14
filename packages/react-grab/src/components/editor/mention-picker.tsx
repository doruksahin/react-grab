import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import type { JiraUserSuggestion } from "./types.js";

/** Module-level cache for mention search results. 60s TTL. */
const mentionCache = new Map<string, { users: JiraUserSuggestion[]; ts: number }>();
const CACHE_TTL = 60_000;

function getCached(query: string): JiraUserSuggestion[] | null {
  const entry = mentionCache.get(query);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.users;
  if (entry) mentionCache.delete(query);
  return null;
}

export function createMentionSuggestion(
  searchFn?: (query: string) => Promise<JiraUserSuggestion[]>,
  getMountContainer?: () => Node,
): Omit<SuggestionOptions, "editor"> {
  return {
    items: async ({ query }) => {
      if (!searchFn || query.length < 1) return [];
      const cached = getCached(query);
      if (cached) return cached;
      const users = await searchFn(query);
      mentionCache.set(query, { users, ts: Date.now() });
      return users;
    },
    render: () => {
      let popup: HTMLDivElement | null = null;
      let selected = 0;
      let items: JiraUserSuggestion[] = [];
      let commandFn: SuggestionProps["command"] | null = null;

      function render() {
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

      function select(index: number) {
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
          popup.addEventListener("mousedown", (e) => {
            e.preventDefault();
            const el = (e.target as HTMLElement).closest("[data-index]");
            if (el) select(Number(el.getAttribute("data-index")));
          });

          items = props.items as JiraUserSuggestion[];
          commandFn = props.command;
          selected = 0;
          render();

          const { decorationNode } = props as SuggestionProps & { decorationNode: HTMLElement | null };
          if (decorationNode) {
            const rect = decorationNode.getBoundingClientRect();
            popup.style.position = "fixed";
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.bottom + 4}px`;
            popup.style.zIndex = "9999";
          }

          const mount = getMountContainer?.() ?? document.body;
          mount.appendChild(popup);
        },
        onUpdate(props: SuggestionProps) {
          items = props.items as JiraUserSuggestion[];
          commandFn = props.command;
          selected = 0;
          render();

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
            render();
            return true;
          }
          if (props.event.key === "ArrowUp") {
            selected = (selected - 1 + items.length) % items.length;
            render();
            return true;
          }
          if (props.event.key === "Enter" || props.event.key === "Tab") {
            select(selected);
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

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function avatarColor(name: string): string {
  const colors = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c", "#3498db", "#9b59b6", "#e91e63"];
  let hash = 0;
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length]!;
}
