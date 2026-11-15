import { type Component, For } from "solid-js";
import { EDITOR_TEXT_COLORS } from "../../../features/jira-comments/editor-text-colors.js";
import { IconButton } from "../../ui/icon-button.js";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group.js";

export const ColorPicker: Component<{
  onSelect: (color: string | null) => void;
  activeColor?: string | null;
}> = (props) => (
  <div
    data-react-grab-color-picker
    class="flex flex-col gap-1 p-2"
    style={{ "min-width": "140px" }}
    data-react-grab-ignore-events
  >
    <IconButton
      data-react-grab-color-reset
      label="Reset color"
      variant="outline"
      class="border-dashed text-meta"
      onMouseDown={(e) => {
        e.preventDefault();
        props.onSelect(null);
      }}
    >
      ↺
    </IconButton>
    <ToggleGroup
      variant="swatch"
      aria-label="Text color"
      value={props.activeColor ?? null}
      // Clicking the active swatch re-applies its colour, as before; only
      // the reset button removes the colour (ToggleGroup would send null).
      onChange={(color) => props.onSelect(color ?? props.activeColor ?? null)}
    >
      <For each={EDITOR_TEXT_COLORS}>
        {(color) => (
          <ToggleGroupItem
            value={color.value}
            color={color.value}
            data-react-grab-color={color.value}
            aria-label={color.name}
            onMouseDown={(e) => e.preventDefault()}
          />
        )}
      </For>
    </ToggleGroup>
  </div>
);
