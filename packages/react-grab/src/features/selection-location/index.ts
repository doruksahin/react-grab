export { locateSelection, ON_PAGE } from "./business/locate-selection.js";
export { describeLocation } from "./business/describe-location.js";
export { openSelectionPage } from "./open-page.js";
export { createCurrentPageUrl } from "./hooks/create-current-page-url.js";
export {
  SelectionLocationProvider,
  useSelectionLocation,
  type LocateSelectionById,
} from "./context.js";
export type { SelectionLocation, LocateSelectionInput } from "./types.js";
