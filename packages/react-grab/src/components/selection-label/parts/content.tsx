import type { Component, JSX } from "solid-js";
import { BottomSection } from "../bottom-section.js";

interface SelectionLabelContentProps {
  children: JSX.Element;
}

export const SelectionLabelContent: Component<SelectionLabelContentProps> = (
  props,
) => {
  return (
    <BottomSection>
      <div data-react-grab-selection-content>{props.children}</div>
    </BottomSection>
  );
};
