import { type Component, Show } from "solid-js";

interface PriorityIconProps {
  priority: string | null | undefined;
}

const UP_TRIANGLE = "M8 3l5 8H3z";
const DOWN_TRIANGLE = "M8 13l5-8H3z";

const getConfig = (
  priority: string | null | undefined,
): { path: string; colorClass: string } | null => {
  switch (priority) {
    case "Highest":
    case "High":
      return { path: UP_TRIANGLE, colorClass: "text-red-400" };
    case "Medium":
      return { path: UP_TRIANGLE, colorClass: "text-amber-400" };
    case "Low":
    case "Lowest":
      return { path: DOWN_TRIANGLE, colorClass: "text-blue-400" };
    default:
      return null;
  }
};

export const PriorityIcon: Component<PriorityIconProps> = (props) => {
  const config = () => getConfig(props.priority);

  return (
    <Show when={config()}>
      {(c) => (
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          class={c().colorClass}
        >
          <path d={c().path} fill="currentColor" />
        </svg>
      )}
    </Show>
  );
};
