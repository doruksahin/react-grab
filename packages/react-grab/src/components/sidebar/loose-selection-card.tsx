// packages/react-grab/src/components/sidebar/loose-selection-card.tsx
import { type Component, Show } from "solid-js";
import type { CommentItem } from "../../types.js";
import type { StatusColorConfig } from "../../features/sidebar/status-colors.js";
import { SelectionCard } from "./selection-card.jsx";
import { Button } from "../ui/button.jsx";

interface LooseSelectionCardProps {
  item: CommentItem;
  /** Status label rendered in the right pill — 'No Task' when no ticket. */
  statusLabel: string;
  /** Status color config — matches the GroupCard pill colors. */
  statusColor: StatusColorConfig;
  /** Ticket id when ticketed. */
  jiraTicketId?: string;
  /** Jira URL when ticketed. */
  jiraUrl?: string;
  /** Click handler for the "Create ticket" button — fires only when no ticket. */
  onCreateTicket: (item: CommentItem) => void;
  /** Remove handler. Passed by the parent only when the selection is
   *  not ticket-locked (i.e. no backing synthetic ticket). */
  onRemoveItem?: (itemId: string) => void;
  syncServerUrl?: string;
  syncWorkspace?: string;
  scrollRoot: () => Element | null;
}

/**
 * Loose-selection card variant. Renders the same SelectionCard markup
 * (component name, screenshots, file path, raw HTML) inside a
 * non-clickable wrapper, with a status pill aligned to match GroupCard
 * and a Create-ticket affordance when no ticket exists yet.
 *
 * SRP: this component owns the *visual contract* of a loose card. It
 * does NOT know about synthetic groups, the dialog, or the orchestrator
 * — those live one level up in `loose-selection-list.tsx` /
 * `core/index.tsx`. The Create-ticket button just calls `onCreateTicket`.
 */
export const LooseSelectionCard: Component<LooseSelectionCardProps> = (props) => {
  const hasTicket = () => Boolean(props.jiraTicketId);

  return (
    <div
      data-react-grab-loose-selection-card
      class="mb-1.5"
      style={{ "pointer-events": "auto" }}
    >
      <div class="bg-muted rounded-lg border border-border p-3 cursor-default">
        {/* Row 1: header — component name + tag, status pill on right */}
        <div class="flex items-center justify-between mb-1.5">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-[13px] font-semibold text-foreground truncate">
              {props.item.componentName || props.item.elementName}
            </span>
            <span class="px-1.5 py-0.5 rounded bg-accent text-muted-foreground text-[10px] font-mono shrink-0">
              {props.item.tagName}
            </span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0 ml-2">
            <span
              class="text-[10px] font-semibold rounded-full px-2 py-0.5"
              style={{
                color: props.statusColor.text,
                background: props.statusColor.bg,
              }}
            >
              {props.statusLabel}
            </span>
            {/* Ticket-lock: × only when the loose item has no ticket. */}
            <Show when={!hasTicket() && props.onRemoveItem}>
              <button
                type="button"
                aria-label="Remove selection"
                title="Remove selection"
                class="flex items-center justify-center size-4 rounded-full bg-red-500 text-white cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onRemoveItem?.(props.item.id);
                }}
              >
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 6 18 18" />
                  <path d="M18 6 6 18" />
                </svg>
              </button>
            </Show>
          </div>
        </div>

        {/* Row 2: meta — timestamp + ticket link (or Create-ticket button) */}
        <div class="flex items-center gap-2 mb-1.5">
          <span class="text-[10px] text-muted-foreground">
            {new Date(props.item.timestamp).toLocaleString()}
          </span>
          <Show
            when={hasTicket()}
            fallback={
              <Button
                variant="outline"
                class="ml-auto h-6 px-2 text-[10px] border-dashed"
                onClick={() => props.onCreateTicket(props.item)}
              >
                + Create ticket
              </Button>
            }
          >
            <span class="text-muted-foreground">·</span>
            <a
              href={props.jiraUrl}
              target="_blank"
              rel="noreferrer"
              class="text-[10px] font-medium text-blue-400 hover:underline"
            >
              {props.jiraTicketId}
            </a>
          </Show>
        </div>

        {/* Inner SelectionCard — reuses its screenshot, file-path, raw-HTML rendering. */}
        <div class="mt-2">
          <SelectionCard
            item={props.item}
            syncServerUrl={props.syncServerUrl}
            syncWorkspace={props.syncWorkspace}
            scrollRoot={props.scrollRoot}
          />
        </div>
      </div>
    </div>
  );
};
