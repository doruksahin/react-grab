import type { Component } from "solid-js";

interface IconXProps {
  size?: number;
  class?: string;
}

export const IconX: Component<IconXProps> = (props) => {
  const size = () => props.size ?? 12;
  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 16 16"
      class={props.class}
      aria-hidden="true"
    >
      <path fill="currentColor" d="M14.03 3.03 9.06 8l4.97 4.97-1.06 1.06L8 9.06l-4.97 4.97-1.06-1.06L6.94 8 1.97 3.03l1.06-1.06L8 6.94l4.97-4.97z" />
    </svg>
  );
};
