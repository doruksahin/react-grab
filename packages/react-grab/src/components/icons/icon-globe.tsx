import type { Component } from "solid-js";

interface IconGlobeProps {
  size?: number;
  class?: string;
}

export const IconGlobe: Component<IconGlobeProps> = (props) => {
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
        <circle cx="8" cy="8" r="6.25" />
        <path d="M1.75 8h12.5M8 1.75C9.6 3.45 10.4 5.6 10.4 8S9.6 12.55 8 14.25C6.4 12.55 5.6 10.4 5.6 8S6.4 3.45 8 1.75Z" />
      </g>
    </svg>
  );
};
