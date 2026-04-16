import type { Component } from "solid-js";

interface IconLockProps {
  size?: number;
  class?: string;
}

export const IconLock: Component<IconLockProps> = (props) => {
  const size = () => props.size ?? 12;
  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 16 16"
      class={props.class}
      aria-hidden="true"
    >
      <path fill="currentColor" fill-rule="evenodd" d="M8 1.5A2.5 2.5 0 0 0 5.5 4v3h5V4A2.5 2.5 0 0 0 8 1.5M12 7V4a4 4 0 0 0-8 0v3a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2M4 8.5a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V9a.5.5 0 0 0-.5-.5zM7.25 13v-3h1.5v3z" clip-rule="evenodd" />
    </svg>
  );
};
