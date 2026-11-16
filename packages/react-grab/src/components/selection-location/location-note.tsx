import { type Component, createMemo, Show } from "solid-js";
import {
  describeLocation,
  openSelectionPage,
  useSelectionLocation,
} from "../../features/selection-location/index.js";
import { useStepGuide } from "../../features/reproduce-steps/index.js";
import { Button } from "../ui/button.js";
import { cn } from "../../utils/cn.js";

export interface LocationNoteProps {
  selectionId: string;
  class?: string;
}

/** Why a selection is not on the page, and the way back to it (ADR-0024). */
export const LocationNote: Component<LocationNoteProps> = (props) => {
  const locate = useSelectionLocation();
  const guide = useStepGuide();
  const selectionLocation = createMemo(() => locate(props.selectionId));
  const reason = createMemo(() => describeLocation(selectionLocation()));
  // ADR-0026: a guide is offered for another page of this site, or for a
  // selection gone from this page, when its steps allow one.
  const canGuide = createMemo(() => {
    const kind = selectionLocation().kind;
    return (
      (kind === "other-page" || kind === "gone") &&
      guide.canStart(props.selectionId)
    );
  });
  const otherPage = createMemo(() => {
    const current = selectionLocation();
    return current.kind === "other-page" ? current : undefined;
  });

  return (
    <Show when={reason()}>
      {(text) => (
        <span
          data-react-grab-selection-location
          data-react-grab-selection-location-kind={selectionLocation().kind}
          class={cn("flex items-center gap-1.5 min-w-0", props.class)}
        >
          <span class="text-meta leading-3 text-muted-foreground truncate">
            {text()}
          </span>
          <Show when={otherPage()}>
            {(page) => (
              <Button
                data-react-grab-ignore-events
                data-react-grab-selection-location-open
                variant="subtle"
                size="xs"
                class="h-4 px-1 shrink-0"
                aria-label={`Open ${page().path}`}
                on:pointerdown={(event) => event.stopPropagation()}
                on:click={(event) => {
                  event.stopPropagation();
                  openSelectionPage(page());
                }}
              >
                Open page
              </Button>
            )}
          </Show>
          <Show when={canGuide()}>
            <Button
              data-react-grab-ignore-events
              data-react-grab-step-guide-start
              variant="subtle"
              size="xs"
              class="h-4 px-1 shrink-0"
              on:pointerdown={(event) => event.stopPropagation()}
              on:click={(event) => {
                event.stopPropagation();
                guide.start(props.selectionId);
              }}
            >
              Guide me
            </Button>
          </Show>
        </span>
      )}
    </Show>
  );
};
