import { type Component, For, Show, createMemo } from "solid-js";
import type { CommentItem } from "../../types.js";
import {
  describeStep,
  downloadUserFlow,
  toUserFlow,
  userFlowFileName,
} from "../../features/reproduce-steps/index.js";
import { CollapsibleCard } from "../ui/collapsible.jsx";
import { Button } from "../ui/button.js";

export interface StepListProps {
  item: CommentItem;
}

/** The steps that led to a selection, and their DevTools export (ADR-0025). */
export const StepList: Component<StepListProps> = (props) => {
  const flow = createMemo(() => toUserFlow(props.item));

  return (
    <Show when={flow()}>
      {(userFlow) => (
        <div data-react-grab-reproduce-steps class="mt-1.5">
          <CollapsibleCard
            variant="inline"
            defaultOpen={false}
            trigger={<span>Steps ({userFlow().steps.length})</span>}
          >
            <ol class="list-decimal pl-5 space-y-0.5 text-meta text-foreground">
              <For each={userFlow().steps}>
                {(step) => (
                  <li data-react-grab-reproduce-steps-item class="break-words">
                    {describeStep(step)}
                  </li>
                )}
              </For>
            </ol>
            <Button
              data-react-grab-reproduce-steps-download
              variant="subtle"
              size="xs"
              class="mt-1.5"
              onClick={() =>
                downloadUserFlow(userFlow(), userFlowFileName(props.item))
              }
            >
              Download Chrome Recorder flow
            </Button>
          </CollapsibleCard>
        </div>
      )}
    </Show>
  );
};
