import type { Component } from "solid-js";

interface IconAlertCircleProps {
  size?: number;
  class?: string;
}

export const IconAlertCircle: Component<IconAlertCircleProps> = (props) => {
  const size = () => props.size ?? 16;

  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
      class={props.class}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.5h.01" />
    </svg>
  );
};
