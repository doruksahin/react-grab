import { type Component, For } from "solid-js";
import { EDITOR_TEXT_COLORS } from "../../../features/jira-comments/editor-text-colors.js";
import { Button } from "../../ui/button.js";

export const ColorPicker: Component<{
  onSelect: (color: string | null) => void;
  activeColor?: string | null;
}> = (props) => (
  <div
    data-react-grab-color-picker
    class="grid gap-1 p-2"
    style={{ "grid-template-columns": "repeat(5, 1fr)", "min-width": "140px" }}
    data-react-grab-ignore-events
  >
    <Button
      type="button"
      data-react-grab-color-reset
      variant="outline"
      size="icon-sm"
      class="border-dashed text-meta"
      title="Reset color"
      aria-label="Reset color"
      onMouseDown={(e) => {
        e.preventDefault();
        props.onSelect(null);
      }}
    >
      ↺
    </Button>
    <For each={EDITOR_TEXT_COLORS}>
      {(color) => (
        <Button
          type="button"
          data-react-grab-color={color}
          variant="swatch"
          size="icon-sm"
          aria-pressed={props.activeColor === color}
          style={{ background: color }}
          title={color}
          aria-label={color}
          onMouseDown={(e) => {
            e.preventDefault();
            props.onSelect(color);
          }}
        />
      )}
    </For>
  </div>
);
