import { type Component, Show } from "solid-js";
import { stepParts } from "@react-grab/selection-text";
import type { ReproduceStep } from "../../features/reproduce-steps/index.js";

export interface StepLineProps {
  step: ReproduceStep;
}

/**
 * One step as the sentence describeStep writes, with the verb muted and a
 * page or selector target set as code (ADR-0025).
 */
export const StepLine: Component<StepLineProps> = (props) => {
  const parts = () => stepParts(props.step);

  return (
    <span class="min-w-0 truncate" title={parts().target}>
      <span class="text-muted-foreground">{parts().verb}</span>{" "}
      <Show
        when={parts().targetKind !== "name"}
        fallback={<span>“{parts().target}”</span>}
      >
        <code class="rounded-sm bg-accent px-1 font-mono text-meta">
          {parts().target}
        </code>
      </Show>
      <Show when={parts().details}>
        {(text) => <span class="text-muted-foreground"> ({text()})</span>}
      </Show>
      <Show when={parts().destination}>
        {(destination) => (
          <span class="text-muted-foreground"> → {destination()}</span>
        )}
      </Show>
    </span>
  );
};
