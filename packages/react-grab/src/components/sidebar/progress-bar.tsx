import type { Component } from "solid-js";

interface ProgressBarProps {
  /** Progress value between 0 and 1 */
  value: number;
  /** Tailwind color class for the fill (e.g., "bg-green-500") */
  colorClass?: string;
}

export const ProgressBar: Component<ProgressBarProps> = (props) => {
  return (
    <div
      data-react-grab-progress-bar
      class="h-1 w-full rounded-full bg-foreground/10"
    >
      <div
        class={`h-1 rounded-full ${props.colorClass ?? "bg-green-500"}`}
        style={{ width: `${props.value * 100}%`, transition: "width 0.3s ease" }}
      />
    </div>
  );
};
