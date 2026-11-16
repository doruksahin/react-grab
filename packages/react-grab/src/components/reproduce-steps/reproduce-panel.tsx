import { type Component, For, Show, createMemo } from "solid-js";
import type { CommentItem } from "../../types.js";
import {
  downloadUserFlow,
  groupRepeatedSteps,
  toUserFlow,
  userFlowFileName,
} from "../../features/reproduce-steps/index.js";
import { CollapsibleCard } from "../ui/collapsible.jsx";
import { Badge } from "../ui/badge.js";
import { Button, buttonVariants } from "../ui/button.js";
import { IconPlay } from "../icons/icon-play.jsx";
import { IconDownload } from "../icons/icon-download.jsx";
import { StepLine } from "./step-line.jsx";
import { cn } from "../../utils/cn.js";

export interface ReproducePanelProps {
  item: CommentItem;
}

const pluralSteps = (count: number): string =>
  count === 1 ? "1 step" : `${count} steps`;

/**
 * How the user got to a selection, in one place: the replay (SPEC-020), the
 * recorded steps and their Chrome Recorder export (ADR-0025).
 */
export const ReproducePanel: Component<ReproducePanelProps> = (props) => {
  const flow = createMemo(() => toUserFlow(props.item));
  const runs = createMemo(() => groupRepeatedSteps(flow()?.steps ?? []));
  const hasContent = () => Boolean(flow() || props.item.recordingUrl);

  return (
    <Show when={hasContent()}>
      <div data-react-grab-reproduce-steps>
        <CollapsibleCard
          variant="row"
          defaultOpen={false}
          disabled={!flow()}
          trigger={
            <>
              <span>How we got here</span>
              <Show when={flow()}>
                {(userFlow) => (
                  <span class="font-normal text-muted-foreground">
                    {pluralSteps(userFlow().steps.length)}
                  </span>
                )}
              </Show>
            </>
          }
          actions={
            <>
              <Show when={props.item.recordingUrl}>
                {(recordingUrl) => (
                  <a
                    data-react-grab-recording-link
                    href={recordingUrl()}
                    target="_blank"
                    rel="noreferrer"
                    title="Watch the replay of how we got here"
                    class={cn(
                      buttonVariants({ variant: "outline", size: "xs" }),
                    )}
                  >
                    <IconPlay size={11} />
                    Replay
                  </a>
                )}
              </Show>
              <Show when={flow()}>
                {(userFlow) => (
                  <Button
                    data-react-grab-reproduce-steps-download
                    type="button"
                    variant="outline"
                    size="xs"
                    aria-label="Download the Chrome Recorder flow"
                    title="Download the Chrome Recorder flow"
                    onClick={() =>
                      downloadUserFlow(userFlow(), userFlowFileName(props.item))
                    }
                  >
                    <IconDownload size={12} />
                    Flow
                  </Button>
                )}
              </Show>
            </>
          }
        >
          <ol class="flex flex-col gap-0.5">
            <For each={runs()}>
              {(run) => (
                <li
                  data-react-grab-reproduce-steps-item
                  class="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-baseline gap-2 text-caption leading-5"
                >
                  <span class="text-right text-meta tabular-nums text-muted-foreground">
                    {run.number}
                  </span>
                  <StepLine step={run.step} />
                  <Show when={run.count > 1}>
                    <Badge variant="count">×{run.count}</Badge>
                  </Show>
                </li>
              )}
            </For>
          </ol>
        </CollapsibleCard>
      </div>
    </Show>
  );
};
