import { type Component, Show } from "solid-js";
import type { CommentItem } from "../../types.js";
import { selectionRowFields } from "../../features/selection-groups/business/selection-row-fields.js";
import { FLAGGED_BORDER_CLASS } from "../../features/sidebar/resolve-display-color.js";
import { useImageLightbox } from "../../features/image-lightbox/index.js";
import { cn } from "../../utils/cn.js";
import { FlagIndicator } from "../flag-indicator.js";
import { SelectionDevInsights } from "../dev-insights/selection-dev-insights.jsx";
import { LocationNotice } from "../selection-location/location-notice.jsx";
import { ReproducePanel } from "../reproduce-steps/reproduce-panel.jsx";
import { SelectionCardBody } from "./selection-card-body.js";
import { SelectionCardMenu } from "./selection-card-menu.jsx";

export interface SelectionCardProps {
  item: CommentItem;
  /** Pre-curried remove handler. When undefined, the card has no menu: the
   *  caller gates this on the ticket-lock rule (ADR-0008). */
  onRemoveItem?: () => void;
  jiraFlagged?: boolean;
  jiraFlaggedAt?: string | null;
  jiraFlaggedBy?: string | null;
  jiraFlaggedByAvatar?: string | null;
}

/**
 * A selection in a group's detail view: the same card body as the sidebar
 * tree, without the ticket, which the group's header shows once.
 */
export const SelectionCard: Component<SelectionCardProps> = (props) => {
  const lightbox = useImageLightbox();
  const rowFields = () => selectionRowFields(props.item);

  return (
    <div
      data-react-grab-selection-card
      class={cn(
        "mb-1.5 rounded-lg border border-border bg-muted p-3",
        props.jiraFlagged && FLAGGED_BORDER_CLASS,
      )}
      style={{ "pointer-events": "auto" }}
    >
      <SelectionCardBody
        leading={
          props.jiraFlagged ? (
            <FlagIndicator
              flaggedAt={props.jiraFlaggedAt}
              flaggedBy={props.jiraFlaggedBy}
              flaggedByAvatar={props.jiraFlaggedByAvatar}
            />
          ) : undefined
        }
        summary={rowFields().title}
        detail={rowFields().detail}
        actions={
          <Show when={props.onRemoveItem}>
            {(onRemove) => <SelectionCardMenu onRemove={onRemove()} />}
          </Show>
        }
        timestamp={props.item.timestamp}
        itemId={props.item.id}
        hasElementScreenshot={Boolean(props.item.screenshotElement)}
        hasFullPageScreenshot={Boolean(props.item.screenshotFullPage)}
        onScreenshotClick={(src, label) => lightbox.open(src, label)}
        locationNote={<LocationNotice selectionId={props.item.id} />}
        reproduceSteps={<ReproducePanel item={props.item} />}
        devInsights={<SelectionDevInsights item={props.item} />}
      />
    </div>
  );
};
