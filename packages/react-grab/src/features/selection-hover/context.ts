import { createContext, useContext } from "solid-js";
import type { SelectionHoverAPI } from "./types.js";

const IDLE_HOVER: SelectionHoverAPI = { hover: () => {} };

const SelectionHoverContext = createContext<SelectionHoverAPI>(IDLE_HOVER);

/** Every list that shows selections lights up the page the same way. */
export const SelectionHoverProvider = SelectionHoverContext.Provider;

export const useSelectionHoverContext = (): SelectionHoverAPI =>
  useContext(SelectionHoverContext);
