import type { Component } from "solid-js";

interface IconDashboardProps {
  size?: number;
  class?: string;
}

export const IconDashboard: Component<IconDashboardProps> = (props) => {
  const size = () => props.size ?? 14;
  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 16 16"
      class={props.class}
    >
      <path fill="currentColor" fill-rule="evenodd" d="M3 2.5a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h4.25v-11zm5.75 0v4.75h4.75V3a.5.5 0 0 0-.5-.5zm4.75 6.25H8.75v4.75H13a.5.5 0 0 0 .5-.5zM1 3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z" clip-rule="evenodd" />
    </svg>
  );
};
