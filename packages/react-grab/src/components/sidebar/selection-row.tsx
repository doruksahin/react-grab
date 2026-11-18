import { type Component, type JSX, Show, children } from "solid-js";
import type { CommentItem } from "../../types.js";
import { selectionRowFields } from "../../features/selection-groups/business/selection-row-fields.js";
import { relativeTime } from "../../features/sidebar/relative-time.js";
import { getStatusLabelColor } from "../../features/sidebar/status-colors.js";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible.jsx";
import { StatusDot } from "../ui/status-dot.js";
import { Avatar } from "../ui/avatar.js";
import { LocationChip } from "../selection-location/location-chip.jsx";
import { IconFlag } from "../icons/icon-flag.jsx";
import { IconPlay } from "../icons/icon-play.jsx";
import {
  SELECTION_ROW_TEXT_INSET_NO_LEADING_PX,
  SELECTION_ROW_TEXT_INSET_PX,
} from "../../constants.js";

interface SelectionRowProps {
  item: CommentItem;
  /** The selection's status (its ticket's), shown as the dot. */
  status: string;
  ticketId?: string;
  flagged?: boolean;
  /** Before the row (the bulk checkbox). */
  leading?: JSX.Element;
  /** The row's menu, shown on hover or focus. */
  actions?: JSX.Element;
  highlighted?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ref?: (element: HTMLElement) => void;
  /** The card that opens under the row. */
  children: JSX.Element;
}

/**
 * One selection in the sidebar list as a short row that opens its card
 * underneath (Kobalte Collapsible; the list keeps one open at a time): the
 * status, the comment and what a reader needs to pick it out at a glance.
 */
export const SelectionRow: Component<SelectionRowProps> = (props) => {
  const fields = () => selectionRowFields(props.item);
  // Read once: each read of a JSX prop would build the checkbox again.
  const leading = children(() => props.leading);
  const statusColor = () => getStatusLabelColor(props.status).hex;

  return (
    <Collapsible
      ref={props.ref}
      open={props.open}
      onOpenChange={props.onOpenChange}
      data-react-grab-selection-card
      tabIndex={-1}
      class="border-b border-border/60 outline-none transition-colors data-[expanded]:bg-foreground/[0.035] data-[expanded]:shadow-[inset_2px_0_0_var(--row-status)]"
      classList={{ "ring-1 ring-inset ring-selection": props.highlighted }}
      style={{ "--row-status": statusColor() }}
    >
      <div class="group/row relative flex items-stretch transition-colors hover:bg-foreground/[0.03]">
        <Show when={leading()}>
          <div class="flex shrink-0 items-start pt-[11px] pl-3">
            {leading()}
          </div>
        </Show>
        <CollapsibleTrigger
          data-react-grab-selection-row
          class="grid min-w-0 flex-1 cursor-pointer grid-cols-[6px_minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-0.5 px-3 py-2 text-left outline-none focus-visible:bg-foreground/[0.05]"
        >
          <StatusDot color={statusColor()} class="self-center" />
          <span class="truncate text-body leading-5 font-medium text-foreground">
            {fields().title}
          </span>
          <span class="text-meta tabular-nums text-muted-foreground group-hover/row:invisible group-focus-within/row:invisible group-has-[[data-react-grab-selection-menu][data-expanded]]/row:invisible">
            {relativeTime(props.item.timestamp)}
          </span>
          <span class="col-start-2 col-span-2 flex min-w-0 items-center gap-2 text-meta text-muted-foreground">
            <span class="sr-only">{props.status}</span>
            <Show when={fields().detail}>
              {(detail) => (
                <span class="min-w-0 truncate font-mono">{detail()}</span>
              )}
            </Show>
            <Show when={props.ticketId}>
              {(ticketId) => (
                <span class="shrink-0 font-mono text-ticket-link">
                  {ticketId()}
                </span>
              )}
            </Show>
            <LocationChip
              selectionId={props.item.id}
              class="min-w-0 max-w-[60%] shrink"
            />
            <Show when={props.flagged}>
              <span class="flex shrink-0 text-flag" title="Flagged">
                <IconFlag size={11} />
              </span>
            </Show>
            <Show when={props.item.recordingUrl}>
              <span class="flex shrink-0" title="Has a replay">
                <IconPlay size={10} />
              </span>
            </Show>
            <Show when={props.item.capturedBy}>
              {(name) => (
                <span
                  class="ml-auto flex shrink-0 items-center gap-1"
                  title={`Captured by ${name()}`}
                >
                  <Avatar name={name()} size="sm" />
                  {name().split(" ")[0]}
                </span>
              )}
            </Show>
          </span>
        </CollapsibleTrigger>
        <Show when={props.actions}>
          <div class="pointer-events-none absolute top-1.5 right-2 opacity-0 transition-opacity group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100 [&:has([data-expanded])]:pointer-events-auto [&:has([data-expanded])]:opacity-100">
            {props.actions}
          </div>
        </Show>
      </div>
      <CollapsibleContent>
        {/* Starts where the row's text starts, so card and row read as one. */}
        <div
          class="pt-0.5 pr-3 pb-3"
          style={{
            "padding-left": `${
              leading()
                ? SELECTION_ROW_TEXT_INSET_PX
                : SELECTION_ROW_TEXT_INSET_NO_LEADING_PX
            }px`,
          }}
        >
          {props.children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
