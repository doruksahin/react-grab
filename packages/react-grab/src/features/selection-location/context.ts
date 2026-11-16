import { createContext, useContext } from "solid-js";
import { ON_PAGE } from "./business/locate-selection.js";
import type { SelectionLocation } from "./types.js";

/** Looks up where a selection is; core provides it (ADR-0024). */
export interface LocateSelectionById {
  (selectionId: string): SelectionLocation;
}

const SelectionLocationContext = createContext<LocateSelectionById>(
  () => ON_PAGE,
);

export const SelectionLocationProvider = SelectionLocationContext.Provider;

export const useSelectionLocation = (): LocateSelectionById =>
  useContext(SelectionLocationContext);
