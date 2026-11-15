import { type Component, For, Show } from "solid-js";
import { resolvePriorityLayers } from "../../features/sidebar/priority-icons.js";

const ICON_SIZE_PX = 12;

interface PriorityIconProps {
  priority: string | null | undefined;
}

export const PriorityIcon: Component<PriorityIconProps> = (props) => {
  const layers = () => resolvePriorityLayers(props.priority);

  return (
    <Show when={layers()}>
      {(l) => (
        <svg width={ICON_SIZE_PX} height={ICON_SIZE_PX} viewBox="0 0 24 24">
          <For each={l()}>
            {(layer) => <path d={layer.path} fill={layer.color} />}
          </For>
        </svg>
      )}
    </Show>
  );
};
