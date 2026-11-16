import type { Component } from "solid-js";

interface IconArchiveProps {
  size?: number;
  class?: string;
}

export const IconArchive: Component<IconArchiveProps> = (props) => {
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
        <rect x="2" y="3" width="12" height="3" rx="0.8" />
        <path d="M3 6v6.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6M6.5 9h3" />
      </g>
    </svg>
  );
};
