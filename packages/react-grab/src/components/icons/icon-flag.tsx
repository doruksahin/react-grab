import type { Component } from "solid-js";

interface IconFlagProps {
  size?: number;
  class?: string;
}

export const IconFlag: Component<IconFlagProps> = (props) => {
  const size = () => props.size ?? 16;

  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 16 16"
      class={props.class}
    >
      <path
        fill="currentColor"
        fill-rule="evenodd"
        d="M2 1.75A.75.75 0 0 1 2.75 1H14a.75.75 0 0 1 .6 1.2l-2.662 3.55L14.6 9.3a.75.75 0 0 1-.6 1.2H3.5V15H2z"
        clip-rule="evenodd"
      />
    </svg>
  );
};
