import { type Component, Show } from "solid-js";
import { useLocationView } from "../../features/selection-location/index.js";
import { Badge } from "../ui/badge.js";
import { IconMapPin } from "../icons/icon-map-pin.jsx";
import { IconGlobe } from "../icons/icon-globe.jsx";

export interface LocationChipProps {
  selectionId: string;
  class?: string;
}

/**
 * A list row's status for a selection that is not on the page: the path or
 * host it was made on, else why it is missing. The way back lives in the
 * card's notice (ADR-0024).
 */
export const LocationChip: Component<LocationChipProps> = (props) => {
  const view = useLocationView(() => props.selectionId);

  return (
    <Show when={view.shortLabel()}>
      {(shortLabel) => (
        <Badge
          data-react-grab-selection-location
          data-react-grab-selection-location-kind={view.location().kind}
          title={view.label()}
          class={props.class}
        >
          <Show
            when={view.location().kind === "other-site"}
            fallback={<IconMapPin size={10} />}
          >
            <IconGlobe size={10} />
          </Show>
          <span class="truncate">{shortLabel()}</span>
        </Badge>
      )}
    </Show>
  );
};
