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
      return "No longer on this page";
    case "unknown":
      return "Not on this page";
  }
};

/** The heading and one line of detail a card's notice shows. */
export interface LocationNotice {
  title: string;
  detail?: string;
}

/** What a card says when its selection is not on the page (ADR-0024). */
export const describeLocationNotice = (
  location: SelectionLocation,
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
        title: "No longer on this page",
        detail: "It was removed or hidden after it was selected.",
      };
    case "unknown":
      return { title: "Not on this page" };
  }
};

/**
 * The few words a list row shows: the host of another site, else the
 * reason sentence ("Made on /boards", "No longer on this page").
 */
export const describeLocationShort = (
  location: SelectionLocation,
): string | undefined =>
  location.kind === "other-site" ? location.host : describeLocation(location);
