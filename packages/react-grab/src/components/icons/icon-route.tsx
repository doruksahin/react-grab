import type { Component } from "solid-js";

interface IconRouteProps {
  size?: number;
  class?: string;
}

export const IconRoute: Component<IconRouteProps> = (props) => {
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
        <circle cx="3.75" cy="12.25" r="1.75" />
        <circle cx="12.25" cy="3.75" r="1.75" />
        <path d="M5.5 12.25h5a2.25 2.25 0 0 0 0-4.5h-5a2.25 2.25 0 0 1 0-4.5h5" />
      </g>
    </svg>
  );
};
