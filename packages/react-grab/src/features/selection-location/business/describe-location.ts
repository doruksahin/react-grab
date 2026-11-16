import type { SelectionLocation } from "../types.js";

/** The one reason text every view shows for a selection not on the page. */
export const describeLocation = (
  location: SelectionLocation,
): string | undefined => {
  switch (location.kind) {
    case "on-page":
      return undefined;
    case "other-page":
      return `Made on ${location.path}`;
    case "other-site":
      return `Made on ${location.host}, another site`;
    case "gone":
      return "Not visible here";
    case "unknown":
      return "Page unknown";
  }
};

/** The heading and one line of detail a card's notice shows. */
export interface LocationNotice {
  title: string;
  detail?: string;
}

export interface LocationNoticeOptions {
  /** A step guide can lead back to it, so the detail may point to it. */
  canGuide: boolean;
}

const GONE_DETAIL =
  "It may be inside a closed dialog, menu or tab, or it was removed.";

/** What a card says when its selection is not on the page (ADR-0024). */
export const describeLocationNotice = (
  location: SelectionLocation,
  { canGuide }: LocationNoticeOptions,
): LocationNotice | undefined => {
  switch (location.kind) {
    case "on-page":
      return undefined;
    case "other-page":
      return { title: "On another page", detail: location.path };
    case "other-site":
      return { title: "Made on another site", detail: location.host };
    case "gone":
      return {
        title: "Not visible on this page",
        detail: canGuide
          ? `${GONE_DETAIL} "Guide me" repeats the steps that showed it.`
          : GONE_DETAIL,
      };
    case "unknown":
      return { title: "Page unknown" };
  }
};

/**
 * The few words a list row shows: the host of another site, else the
 * reason sentence ("Made on /boards", "Not visible here").
 */
export const describeLocationShort = (
  location: SelectionLocation,
): string | undefined =>
  location.kind === "other-site" ? location.host : describeLocation(location);
