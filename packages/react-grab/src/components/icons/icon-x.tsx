import type { Component } from "solid-js";

interface IconXProps {
  size?: number;
  class?: string;
}

export const IconX: Component<IconXProps> = (props) => {
  const size = () => props.size ?? 12;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size()}
      height={size()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
      aria-hidden="true"
    >
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  );
};
