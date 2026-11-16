import type { Component } from "solid-js";

interface IconMapPinProps {
  size?: number;
  class?: string;
}

export const IconMapPin: Component<IconMapPinProps> = (props) => {
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
        <path d="M8 14.25s4.75-4.1 4.75-8a4.75 4.75 0 1 0-9.5 0c0 3.9 4.75 8 4.75 8Z" />
        <circle cx="8" cy="6.25" r="1.75" />
      </g>
    </svg>
  );
};
