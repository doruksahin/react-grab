import type { Component } from "solid-js";

interface IconEllipsisProps {
  size?: number;
  class?: string;
}

export const IconEllipsis: Component<IconEllipsisProps> = (props) => {
  const size = () => props.size ?? 12;

  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 16 16"
      class={props.class}
    >
      <path fill="currentColor" fill-rule="evenodd" d="M0 8a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0m6.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0M13 8a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0" clip-rule="evenodd" />
    </svg>
  );
};
