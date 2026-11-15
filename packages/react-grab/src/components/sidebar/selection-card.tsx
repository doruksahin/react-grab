// packages/react-grab/src/components/sidebar/selection-card.tsx
import { type Component, createMemo, Show } from "solid-js";
import type { CommentItem } from "../../types.js";
import { useDevMode } from "../../features/dev-mode/index.js";
import { extractFilePath, relativeTime } from "../../features/sidebar/index.js";
import { screenshotRefs } from "../../features/screenshot/index.js";
import { useSyncPorts } from "../../features/sync/sync-ports-context.js";
import { ScreenshotPair } from "./screenshot-pair.js";
import { RemoveSelectionButton } from "../remove-selection-button.jsx";
import { FlagIndicator } from "../flag-indicator.js";
import { FLAGGED_BORDER_CLASS } from "../../features/sidebar/resolve-display-color.js";
import { cn } from "../../utils/cn.js";
import { DevInsights } from "../dev-insights/index.js";

export interface SelectionCardProps {
  item: CommentItem;
  scrollRoot: () => Element | null;
  /** Pre-curried remove handler. When undefined, the × button is not
   *  rendered — the caller gates this on the ticket-lock rule. */
  onRemoveItem?: () => void;
  jiraFlagged?: boolean;
  jiraFlaggedAt?: string | null;
  jiraFlaggedBy?: string | null;
  jiraFlaggedByAvatar?: string | null;
}

export const SelectionCard: Component<SelectionCardProps> = (props) => {
  const isDevMode = useDevMode();
  const filePath = createMemo(() => extractFilePath(props.item.content ?? ""));

  const { storage } = useSyncPorts();
  const screenshots = createMemo(() =>
    storage() ? screenshotRefs(props.item) : {},
  );

  return (
    <div
      data-react-grab-selection-card
      class={cn(
        "bg-muted rounded-lg p-3 mb-1.5 border border-border",
        props.jiraFlagged && FLAGGED_BORDER_CLASS,
      )}
      style={{ "pointer-events": "auto" }}
    >
      {/* Row 1: component name + flag icon + tag badge + timestamp + remove */}
      <div class="flex items-center justify-between mb-1.5">
        <div class="flex items-center gap-1.5 min-w-0">
          <Show when={props.jiraFlagged}>
            <FlagIndicator
              flaggedAt={props.jiraFlaggedAt}
              flaggedBy={props.jiraFlaggedBy}
              flaggedByAvatar={props.jiraFlaggedByAvatar}
            />
          </Show>
          <span class="text-body font-semibold text-foreground truncate">
            {props.item.componentName || props.item.elementName}
          </span>
          <span class="px-1.5 py-0.5 rounded bg-accent text-muted-foreground text-meta font-mono shrink-0">
            {props.item.tagName}
          </span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0 ml-2">
          <span class="text-meta text-muted-foreground">
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
        <p class="text-meta text-foreground mb-1.5">{props.item.commentText}</p>
      </Show>

      {/* Screenshots — hidden entirely when both are absent (A-018) */}
      <Show when={screenshots().element || screenshots().fullPage}>
        <ScreenshotPair
          element={screenshots().element}
          fullPage={screenshots().fullPage}
          scrollRoot={props.scrollRoot}
        />
      </Show>

      {/* Dev Insights — unified technical metadata (visible in DEV mode only) */}
      <Show when={isDevMode()}>
        <DevInsights>
          <DevInsights.Field
            label="tag"
            value={props.item.tagName}
            kind="tag"
          />
          <DevInsights.Field
            label="node"
            value={props.item.componentName ?? props.item.elementName}
            kind="component"
          />
          <DevInsights.Field
            label="file"
            value={
              filePath()
                ? `${filePath()!.path}${filePath()!.line !== null ? `:${filePath()!.line}` : ""}`
                : undefined
            }
            kind="string"
          />
          <DevInsights.Attributes content={props.item.content} />
          <Show when={props.item.elementSelectors?.[0]}>
            <DevInsights.Section label="selector">
              <span class="text-meta font-mono text-foreground/80 break-all">
                {props.item.elementSelectors?.[0]}
              </span>
            </DevInsights.Section>
          </Show>
          <DevInsights.Section label="html">
            <pre class="text-meta font-mono text-foreground/80 whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto leading-relaxed">
              {props.item.content}
            </pre>
          </DevInsights.Section>
        </DevInsights>
      </Show>
    </div>
  );
};
