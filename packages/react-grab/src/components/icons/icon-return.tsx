import type { Component } from "solid-js";

interface IconReturnProps {
  size?: number;
  class?: string;
}

export const IconReturn: Component<IconReturnProps> = (props) => {
  const size = () => props.size ?? 12;

  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 16 16"
      class={props.class}
    >
      <path fill="currentColor" fill-rule="evenodd" d="m1.22 7.47 5-5 1.06 1.06-3.72 3.72H15v1.5H3.56l3.72 3.72-1.06 1.06-5-5a.75.75 0 0 1 0-1.06" clip-rule="evenodd" />
    </svg>
  );
};
