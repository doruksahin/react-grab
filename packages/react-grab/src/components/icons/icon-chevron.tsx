import type { Component } from "solid-js";

interface IconChevronProps {
  size?: number;
  class?: string;
}

export const IconChevron: Component<IconChevronProps> = (props) => {
  const size = () => props.size ?? 12;

  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 16 16"
      class={props.class}
    >
      <path fill="currentColor" d="m14.53 9.97-6-6a.75.75 0 0 0-1.004-.052l-.056.052-6 6 1.06 1.06L8 5.56l5.47 5.47z" />
    </svg>
  );
};
