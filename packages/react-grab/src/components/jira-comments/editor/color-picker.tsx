import { type Component, For } from "solid-js";

const COLORS = [
  "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c",
  "#3498db", "#9b59b6", "#e91e63", "#95a5a6", "#2c3e50",
];

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
    <button
      type="button"
      data-react-grab-color-reset
      class="w-6 h-6 rounded border border-dashed border-muted-foreground flex items-center justify-center text-[10px] text-muted-foreground hover:border-foreground"
      title="Reset color"
      onMouseDown={(e) => {
        e.preventDefault();
        props.onSelect(null);
      }}
    >
      ↺
    </button>
    <For each={COLORS}>
      {(color) => (
        <button
          type="button"
          data-react-grab-color={color}
          class={[
            "w-6 h-6 rounded border-2 transition-all hover:scale-110",
            props.activeColor === color ? "border-foreground" : "border-transparent",
          ].join(" ")}
          style={{ background: color }}
          title={color}
          onMouseDown={(e) => {
            e.preventDefault();
            props.onSelect(color);
          }}
        />
      )}
    </For>
  </div>
);
