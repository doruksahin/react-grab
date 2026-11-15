import { Show } from "solid-js";
import type { Component } from "solid-js";
import { DevInsights } from "../../dev-insights/index.js";
import { useSelectionLabelContext } from "../context.js";

export interface DevInsightsSectionProps {
  tagName?: string;
  componentName?: string;
}

export const DevInsightsSection: Component<DevInsightsSectionProps> = (
  props,
) => {
  const ctx = useSelectionLabelContext();

  return (
    <Show when={ctx.isDevMode() && props.tagName}>
      <DevInsights>
        <DevInsights.Field label="tag" value={props.tagName} kind="tag" />
        <DevInsights.Field
          label="node"
          value={props.componentName}
          kind="component"
        />
      </DevInsights>
    </Show>
  );
};
