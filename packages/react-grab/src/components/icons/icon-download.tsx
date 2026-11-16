import type { Component } from "solid-js";

interface IconDownloadProps {
  size?: number;
  class?: string;
}

export const IconDownload: Component<IconDownloadProps> = (props) => {
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
        <path d="M8 2.25v8M4.75 7 8 10.25 11.25 7M2.75 11v1.25a1 1 0 0 0 1 1h8.5a1 1 0 0 0 1-1V11" />
      </g>
    </svg>
  );
};
