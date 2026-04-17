import type { Component } from "solid-js";
import type { SelectionLabelContentProps } from "../types.js";
import { BottomSection } from "../bottom-section.js";

export const SelectionLabelContent: Component<SelectionLabelContentProps> = (
  props,
) => {
  return (
    <BottomSection>
      <div data-react-grab-selection-content>{props.children}</div>
    </BottomSection>
  );
};
