import { type Accessor, createMemo } from "solid-js";
import { useStepGuide } from "../../reproduce-steps/index.js";
import {
  describeLocation,
  describeLocationNotice,
  describeLocationShort,
  type LocationNotice,
} from "../business/describe-location.js";
import { useSelectionLocation } from "../context.js";
import { openSelectionPage } from "../open-page.js";
import type { SelectionLocation } from "../types.js";

type OtherPageLocation = Extract<SelectionLocation, { kind: "other-page" }>;

export interface LocationView {
  location: Accessor<SelectionLocation>;
  /** The sentence that says why it is not here. */
  label: Accessor<string | undefined>;
  /** The few words a list row shows. */
  shortLabel: Accessor<string | undefined>;
  /** The heading and detail a card shows. */
  notice: Accessor<LocationNotice | undefined>;
  /** The page to open, when the selection was made on another page here. */
  otherPage: Accessor<OtherPageLocation | undefined>;
  /** A step guide can lead back to it (ADR-0026). */
  canGuide: Accessor<boolean>;
  openPage: () => void;
  startGuide: () => void;
}

/**
 * Where a selection is and the ways back to it, for every view that shows a
 * selection not on the page (ADR-0024, ADR-0026).
 */
export const useLocationView = (selectionId: () => string): LocationView => {
  const locate = useSelectionLocation();
  const guide = useStepGuide();
  const location = createMemo(() => locate(selectionId()));
  const otherPage = createMemo(() => {
    const current = location();
    return current.kind === "other-page" ? current : undefined;
  });
  // A guide is offered for another page of this site, or for a selection
  // gone from this page, when its steps allow one.
  const canGuide = createMemo(() => {
    const kind = location().kind;
    return (
      (kind === "other-page" || kind === "gone") &&
      guide.canStart(selectionId())
    );
  });

  return {
    location,
    label: () => describeLocation(location()),
    shortLabel: () => describeLocationShort(location()),
    notice: () => describeLocationNotice(location()),
    otherPage,
    canGuide,
    openPage: () => {
      const page = otherPage();
      if (page) openSelectionPage(page);
    },
    startGuide: () => guide.start(selectionId()),
  };
};
