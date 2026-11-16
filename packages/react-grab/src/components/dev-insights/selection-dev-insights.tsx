import { type Component, createMemo, Show } from "solid-js";
import type { CommentItem } from "../../types.js";
import { useDevMode } from "../../features/dev-mode/index.js";
import { sourceLocation } from "@react-grab/selection-text";
import { DevInsights } from "./index.js";

export interface SelectionDevInsightsProps {
  item: CommentItem;
}

/** A selection's technical details, shown in dev mode only. */
export const SelectionDevInsights: Component<SelectionDevInsightsProps> = (
  props,
) => {
  const isDevMode = useDevMode();
  const filePath = createMemo(() => sourceLocation(props.item.content ?? ""));

  return (
    <Show when={isDevMode()}>
      <DevInsights>
        <DevInsights.Field label="tag" value={props.item.tagName} kind="tag" />
        <DevInsights.Field
          label="node"
          value={props.item.componentName ?? props.item.elementName}
          kind="component"
        />
        <DevInsights.Field label="file" value={filePath()} kind="string" />
        <DevInsights.Attributes content={props.item.content} />
        <Show when={props.item.elementSelectors?.[0]}>
          {(selector) => (
            <DevInsights.Section label="selector">
              <span class="text-meta font-mono text-foreground/80 break-all">
                {selector()}
              </span>
            </DevInsights.Section>
          )}
        </Show>
        <DevInsights.Section label="html">
          <pre class="text-meta font-mono text-foreground/80 whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto leading-relaxed">
            {props.item.content}
          </pre>
        </DevInsights.Section>
      </DevInsights>
    </Show>
  );
};
