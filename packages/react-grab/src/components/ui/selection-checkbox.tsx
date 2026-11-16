import { Checkbox } from "@kobalte/core/checkbox";
import type { Component } from "solid-js";
import { cn } from "../../utils/cn.js";

interface SelectionCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  class?: string;
}

/** A small checkbox for picking items in bulk (Kobalte Checkbox). */
export const SelectionCheckbox: Component<SelectionCheckboxProps> = (props) => (
  <Checkbox
    data-react-grab-selection-checkbox
    checked={props.checked}
    onChange={() => props.onToggle()}
    class={cn("inline-flex shrink-0", props.class)}
    onClick={(event: MouseEvent) => event.stopPropagation()}
  >
    <Checkbox.Input aria-label={props.label} class="peer" />
    <Checkbox.Control
      class={cn(
        "flex size-3.5 cursor-pointer items-center justify-center rounded-sm border transition-colors",
        "border-foreground/20 bg-foreground/[0.03]",
        "data-[checked]:border-selection data-[checked]:bg-selection",
        "peer-focus-visible:ring-1 peer-focus-visible:ring-ring",
      )}
    >
      <Checkbox.Indicator class="text-white">
        <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true">
          <path
            fill="currentColor"
            d="m13.959 3.97-7.25 9a.75.75 0 0 1-1.163.007l-3.5-4.25 1.158-.954 2.914 3.539 6.673-8.283z"
          />
        </svg>
      </Checkbox.Indicator>
    </Checkbox.Control>
  </Checkbox>
);
