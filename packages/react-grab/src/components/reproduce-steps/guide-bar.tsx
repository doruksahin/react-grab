import { type Component, Match, Show, Switch } from "solid-js";
import { useStepGuide } from "../../features/reproduce-steps/index.js";
import { Button } from "../ui/button.js";

/** The running step guide: the current step, and Skip / Stop (ADR-0026). */
export const GuideBar: Component = () => {
  const guide = useStepGuide();

  return (
    <Show when={guide.view()}>
      {(view) => (
        <div
          data-react-grab-ignore-events
          data-react-grab-step-guide
          data-react-grab-step-guide-status={view().status}
          role="status"
          aria-live="polite"
          class="fixed left-1/2 top-4 -translate-x-1/2 flex items-center gap-2 rounded-[10px] bg-popover px-3 py-2 text-body text-popover-foreground antialiased drop-shadow-overlay max-w-[min(560px,calc(100vw-32px))]"
          style={{ "z-index": "var(--z-dialog)", "pointer-events": "auto" }}
        >
          <span data-react-grab-step-guide-text class="min-w-0 flex-1">
            <Switch>
              <Match when={view().status === "loading"}>
                Loading the selection…
              </Match>
              <Match when={view().status === "found"}>
                Here is the selection.
              </Match>
              <Match when={view().status === "missing"}>
                The selection is not on this page.
              </Match>
              <Match when={view().status === "removed"}>
                This selection is no longer saved.
              </Match>
              <Match when={view().status === "looking"}>
                Step {view().stepNumber} of {view().stepCount}:{" "}
                {view().sentence}{" "}
                <span class="text-muted-foreground">
                  (waiting for it to appear)
                </span>
              </Match>
              <Match when={view().status === "showing"}>
                Step {view().stepNumber} of {view().stepCount}:{" "}
                {view().sentence}
              </Match>
            </Switch>
          </span>
          <Show when={view().stepNumber > 0}>
            <Button
              data-react-grab-step-guide-skip
              variant="subtle"
              size="xs"
              onClick={() => guide.skip()}
            >
              Skip
            </Button>
          </Show>
          <Button
            data-react-grab-step-guide-stop
            variant="subtle"
            size="xs"
            onClick={() => guide.stop()}
          >
            {view().stepNumber > 0 ? "Stop" : "Close"}
          </Button>
        </div>
      )}
    </Show>
  );
};
