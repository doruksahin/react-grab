import { createContext, useContext } from "solid-js";
import type { Accessor } from "solid-js";
import type { ArrowPosition, SelectionLabelStatus } from "../../types.js";

export interface SelectionLabelContextValue {
  status: Accessor<SelectionLabelStatus | undefined>;
  canInteract: Accessor<boolean>;
  isPromptMode: Accessor<boolean>;
  arrowPosition: Accessor<ArrowPosition>;
  isDevMode: Accessor<boolean>;
}

const SelectionLabelContext = createContext<SelectionLabelContextValue>();

export const SelectionLabelProvider = SelectionLabelContext.Provider;

export const useSelectionLabelContext = (): SelectionLabelContextValue => {
  const ctx = useContext(SelectionLabelContext);
  if (!ctx) {
    throw new Error(
      "useSelectionLabelContext must be used within <SelectionLabel.Root>",
    );
  }
  return ctx;
};
