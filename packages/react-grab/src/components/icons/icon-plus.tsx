import type { Component } from "solid-js";

interface IconPlusProps {
  size?: number;
  class?: string;
}

export const IconPlus: Component<IconPlusProps> = (props) => {
  const size = () => props.size ?? 14;

  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      class={props.class}
      aria-hidden="true"
    >
      <path d="M8 2.5v11M2.5 8h11" />
    </svg>
  );
};
