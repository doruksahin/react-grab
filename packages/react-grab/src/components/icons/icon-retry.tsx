import type { Component } from "solid-js";

interface IconRetryProps {
  size?: number;
  class?: string;
}

export const IconRetry: Component<IconRetryProps> = (props) => {
  const size = () => props.size ?? 12;

  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 16 16"
      class={props.class}
    >
      <path fill="currentColor" fill-rule="evenodd" d="M2.5 3.67V1H1v5c0 .414.336.75.75.75H6.5v-1.5H3.236a5.5 5.5 0 1 1-.666 3.63l-1.48.24A7.002 7.002 0 0 0 15 8 7 7 0 0 0 2.5 3.67" clip-rule="evenodd" />
    </svg>
  );
};
