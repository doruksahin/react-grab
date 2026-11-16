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
