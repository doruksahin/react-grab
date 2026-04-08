// packages/react-grab/src/components/sidebar/selection-card.tsx
import { type Component, createMemo, Show } from "solid-js";
import type { CommentItem } from "../../types";
import {
  extractFilePath,
  relativeTime,
  screenshotUrl,
} from "../../features/sidebar";
import { ScreenshotPair } from "./screenshot-pair";
import { RemoveSelectionButton } from "../remove-selection-button.jsx";

export interface SelectionCardProps {
  item: CommentItem;
  syncServerUrl?: string;
  syncWorkspace?: string;
  scrollRoot: () => Element | null;
  /** Pre-curried remove handler. When undefined, the × button is not
   *  rendered — the caller gates this on the ticket-lock rule. */
  onRemoveItem?: () => void;
}

export const SelectionCard: Component<SelectionCardProps> = (props) => {
  const filePath = createMemo(() =>
    extractFilePath(props.item.content ?? ""),
  );

  const elementSrc = createMemo(() =>
    props.syncServerUrl &&
    props.syncWorkspace &&
    props.item.screenshotElement
      ? screenshotUrl(
          props.syncServerUrl,
          props.syncWorkspace,
          props.item.id,
          "element",
        )
      : undefined,
  );

  const fullPageSrc = createMemo(() =>
    props.syncServerUrl &&
    props.syncWorkspace &&
    props.item.screenshotFullPage
      ? screenshotUrl(
          props.syncServerUrl,
          props.syncWorkspace,
          props.item.id,
          "full",
        )
      : undefined,
  );

  return (
    <div
      data-react-grab-selection-card
      class="bg-muted rounded-lg p-3 mb-1.5 border border-border"
      style={{ "pointer-events": "auto" }}
    >
      {/* Row 1: component name + tag badge + timestamp + remove */}
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
          <span class="text-[10px] text-muted-foreground">
            {relativeTime(props.item.timestamp)}
          </span>
          {/* Ticket-lock gates visibility at the caller — if the prop is
              set, the selection is removable. */}
          <Show when={props.onRemoveItem}>
            <RemoveSelectionButton onRemove={() => props.onRemoveItem?.()} />
          </Show>
        </div>
      </div>

      {/* Row 2: comment text */}
      <Show when={props.item.commentText}>
        <p class="text-[11px] text-foreground mb-1.5">{props.item.commentText}</p>
      </Show>

      {/* Row 3: source file path (omit when extraction returns null — A-014) */}
      <Show when={filePath()}>
        {(fp) => (
          <div
            class="text-[10px] text-muted-foreground font-mono truncate mb-1.5"
            title={fp().path}
          >
            {fp().path}
            <Show when={fp().line !== null}>
              <span class="text-muted-foreground">:{fp().line}</span>
            </Show>
          </div>
        )}
      </Show>

      {/* Row 4: screenshots — hidden entirely when both are absent (A-018) */}
      <Show when={elementSrc() || fullPageSrc()}>
        <ScreenshotPair
          elementSrc={elementSrc()}
          fullPageSrc={fullPageSrc()}
          scrollRoot={props.scrollRoot}
        />
      </Show>

      {/* Row 5: CSS selector */}
      <Show when={props.item.elementSelectors?.length}>
        <div
          class="text-[10px] text-muted-foreground font-mono truncate mt-1.5"
          title={props.item.elementSelectors?.[0]}
        >
          {props.item.elementSelectors?.[0]}
        </div>
      </Show>

      {/* Row 6: collapsible raw HTML — collapsed by default */}
      <details class="mt-1.5">
        <summary class="text-[10px] text-muted-foreground cursor-pointer select-none hover:text-foreground">
          Raw HTML
        </summary>
        <pre class="mt-1 text-[9px] text-muted-foreground bg-muted rounded p-2 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all">
          {props.item.content}
        </pre>
      </details>
    </div>
  );
};
