import type { Component } from "solid-js";

interface IconEyeFilledProps {
  size?: number;
  class?: string;
}

export const IconEyeFilled: Component<IconEyeFilledProps> = (props) => {
  const size = () => props.size ?? 14;

  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 16 16"
      class={props.class}
    >
      <path fill="currentColor" d="M5.75 8a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0" />
      <path fill="currentColor" fill-rule="evenodd" d="M8 2C4.433 2 1.319 4.232.167 7.38c-.146.4-.146.84 0 1.24C1.32 11.768 4.433 14 8 14c3.566 0 6.681-2.232 7.833-5.38.146-.4.146-.84 0-1.24C14.68 4.232 11.566 2 8 2m0 2.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5" clip-rule="evenodd" />
    </svg>
  );
};
