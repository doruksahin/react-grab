import type { Component } from "solid-js";

interface IconRestoreProps {
  size?: number;
  class?: string;
}

export const IconRestore: Component<IconRestoreProps> = (props) => {
  const size = () => props.size ?? 14;

  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      aria-hidden="true"
    >
      <g>
        <path d="M3 8a5 5 0 1 0 1.5-3.5M3 2.5v3h3" />
      </g>
    </svg>
  );
};
