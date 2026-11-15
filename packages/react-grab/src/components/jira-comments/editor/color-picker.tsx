import { type Component, For } from "solid-js";
import { EDITOR_TEXT_COLORS } from "../../../features/jira-comments/editor-text-colors.js";
import { Button } from "../../ui/button.js";
import { SwatchGroup, SwatchGroupItem } from "../../ui/swatch-group.js";

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
    <SwatchGroup
      aria-label="Text color"
      value={props.activeColor ?? null}
      onChange={(color) => props.onSelect(color)}
    >
      <For each={EDITOR_TEXT_COLORS}>
        {(color) => (
          <SwatchGroupItem
            value={color}
            color={color}
            data-react-grab-color={color}
            title={color}
            aria-label={color}
            onMouseDown={(e) => e.preventDefault()}
          />
        )}
      </For>
    </SwatchGroup>
  </div>
);
