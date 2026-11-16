import type { Component, JSX } from "solid-js";
import { CollapsibleCard } from "../ui/collapsible.jsx";
import { Badge } from "../ui/badge.js";

export interface DevInsightsShellProps {
  children: JSX.Element;
  /** Start expanded. @default false */
  defaultOpen?: boolean;
  /** Additional class on the outer wrapper. */
  class?: string;
}

/** The selection's technical details, a section like the card's others. */
export const DevInsightsShell: Component<DevInsightsShellProps> = (props) => (
  <div data-react-grab-dev-insights class={props.class}>
    <CollapsibleCard
      variant="row"
      defaultOpen={props.defaultOpen ?? false}
      trigger={
        <>
          <span>Dev insights</span>
          <Badge tone="dev" size="sm">
            DEV
          </Badge>
        </>
      }
    >
      <div class="flex flex-col gap-px font-mono">{props.children}</div>
    </CollapsibleCard>
  </div>
);
