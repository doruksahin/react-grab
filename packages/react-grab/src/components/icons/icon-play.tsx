import type { Component } from "solid-js";

interface IconPlayProps {
  size?: number;
  class?: string;
}

export const IconPlay: Component<IconPlayProps> = (props) => {
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
        <path d="M4.75 2.75v10.5L13 8z" />
      </g>
    </svg>
  );
};
