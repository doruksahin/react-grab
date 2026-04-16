import { type Component, For, Show } from "solid-js";

interface PriorityIconProps {
  priority: string | null | undefined;
}

interface PriorityLayer {
  path: string;
  color: string;
}

const ICON_SIZE_PX = 12;

const PRIORITIES: Record<string, PriorityLayer[]> = {
  Highest: [
    {
      path: "M12.005 8.187l-6.453 3.865a1 1 0 01-1.028-1.716l6.97-4.174a1 1 0 011.031.002l6.906 4.174a1 1 0 11-1.035 1.712l-6.39-3.863z",
      color: "#FF5630",
    },
    {
      path: "M5.552 18.054a1 1 0 11-1.028-1.715l6.97-4.174a1 1 0 011.031.002l6.906 4.174a1 1 0 11-1.035 1.711l-6.39-3.862-6.454 3.864z",
      color: "#FF7452",
    },
  ],
  High: [
    {
      path: "M12.017 11.182l-6.454 3.865a1 1 0 11-1.027-1.716l6.97-4.174a1 1 0 011.03.003l6.906 4.173a1 1 0 01-1.035 1.712l-6.39-3.863z",
      color: "#FF5630",
    },
  ],
  Medium: [
    {
      path: "M5 8h14a1 1 0 010 2H5a1 1 0 110-2zm0 6h14a1 1 0 010 2H5a1 1 0 010-2z",
      color: "#FFAB00",
    },
  ],
  Low: [
    {
      path: "M11.996 13.861l6.454-3.865a1 1 0 111.027 1.716l-6.97 4.174a1 1 0 01-1.03-.002L4.57 11.71A1 1 0 015.606 10l6.39 3.862z",
      color: "#0065FF",
    },
  ],
  Lowest: [
    {
      path: "M18.46 11.936a1 1 0 111.028 1.716l-6.97 4.174a1 1 0 01-1.03-.002L4.581 13.65a1 1 0 011.034-1.711l6.391 3.862 6.454-3.865z",
      color: "#0065FF",
    },
    {
      path: "M12.007 9.798l6.454-3.864a1 1 0 011.027 1.716l-6.97 4.173a1 1 0 01-1.03-.002L4.581 7.648a1 1 0 011.034-1.712l6.391 3.862z",
      color: "#2684FF",
    },
  ],
};

const resolve = (priority: string | null | undefined): PriorityLayer[] | null => {
  if (!priority) return null;
  return PRIORITIES[priority] ?? null;
};

export const PriorityIcon: Component<PriorityIconProps> = (props) => {
  const layers = () => resolve(props.priority);

  return (
    <Show when={layers()}>
      {(l) => (
        <svg
          width={ICON_SIZE_PX}
          height={ICON_SIZE_PX}
          viewBox="0 0 24 24"
        >
          <For each={l()}>
            {(layer) => <path d={layer.path} fill={layer.color} />}
          </For>
        </svg>
      )}
    </Show>
  );
};
