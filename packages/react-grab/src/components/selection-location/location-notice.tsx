import { type Component, Show } from "solid-js";
import { useLocationView } from "../../features/selection-location/index.js";
import { alertVariants } from "../ui/alert.js";
import { Button } from "../ui/button.js";
import { IconMapPin } from "../icons/icon-map-pin.jsx";
import { IconGlobe } from "../icons/icon-globe.jsx";
import { IconRoute } from "../icons/icon-route.jsx";
import { IconOpen } from "../icons/icon-open.jsx";

export interface LocationNoticeProps {
  selectionId: string;
}

const stopPointer = (event: PointerEvent) => event.stopPropagation();

/**
 * A card's notice for a selection that is not on the page: what happened,
 * and the way back to it (ADR-0024, ADR-0026). It looks like an Alert but is
 * not a live region: every card in a list would otherwise be announced.
 */
export const LocationNotice: Component<LocationNoticeProps> = (props) => {
  const view = useLocationView(() => props.selectionId);

  return (
    <Show when={view.notice()}>
      {(notice) => (
        <div
          data-react-grab-selection-location
          data-react-grab-selection-location-kind={view.location().kind}
          class={alertVariants({ tone: "neutral", size: "sm" })}
        >
          <Show
            when={view.location().kind === "other-site"}
            fallback={<IconMapPin size={14} class="mt-px shrink-0" />}
          >
            <IconGlobe size={14} class="mt-px shrink-0" />
          </Show>
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="font-medium">{notice().title}</span>
            <Show when={notice().detail}>
              {(detail) => (
                <span class="break-words text-muted-foreground">
                  {detail()}
                </span>
              )}
            </Show>
            <Show when={view.canGuide() || view.otherPage()}>
              <div class="mt-1.5 flex flex-wrap gap-1.5">
                <Show when={view.canGuide()}>
                  <Button
                    data-react-grab-ignore-events
                    data-react-grab-step-guide-start
                    type="button"
                    size="xs"
                    on:pointerdown={stopPointer}
                    on:click={(event) => {
                      event.stopPropagation();
                      view.startGuide();
                    }}
                  >
                    <IconRoute size={12} />
                    Guide me
                  </Button>
                </Show>
                <Show when={view.otherPage()}>
                  {(page) => (
                    <Button
                      data-react-grab-ignore-events
                      data-react-grab-selection-location-open
                      type="button"
                      variant="outline"
                      size="xs"
                      aria-label={`Open ${page().path}`}
                      on:pointerdown={stopPointer}
                      on:click={(event) => {
                        event.stopPropagation();
                        view.openPage();
                      }}
                    >
                      <IconOpen size={12} />
                      Open page
                    </Button>
                  )}
                </Show>
              </div>
            </Show>
          </div>
        </div>
      )}
    </Show>
  );
};
