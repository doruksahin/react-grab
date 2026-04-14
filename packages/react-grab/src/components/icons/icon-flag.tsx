import type { Component } from "solid-js";

interface IconFlagProps {
  size?: number;
  class?: string;
}

/**
 * Filled flag icon — exact JIRA "flagged/impediment" indicator.
 * SVG path from Atlassian Design System (@atlaskit/icon).
 *
 * @see decree/adr/0009-flag-data-source-and-blocked-visual-strategy.md
 */
export const IconFlag: Component<IconFlagProps> = (props) => {
  const size = () => props.size ?? 16;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size()}
      height={size()}
      viewBox="-4 -4 24 24"
      fill="none"
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
