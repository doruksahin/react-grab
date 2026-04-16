import { type Component, Show } from "solid-js";

interface SelectionCheckboxProps {
  checked: boolean;
  onToggle: (e: MouseEvent) => void;
}

export const SelectionCheckbox: Component<SelectionCheckboxProps> = (props) => (
  <div
    class="w-[14px] h-[14px] border rounded-[3px] shrink-0 flex items-center justify-center cursor-pointer transition-all"
    classList={{
      "bg-purple-400 border-purple-400": props.checked,
      "bg-foreground/[0.03] border-foreground/20": !props.checked,
    }}
    onClick={(e: MouseEvent) => {
      e.stopPropagation();
      props.onToggle(e);
    }}
  >
    <Show when={props.checked}>
      <span class="text-white text-[9px] font-bold">{"\u2713"}</span>
    </Show>
  </div>
);
