import type { Component } from "solid-js";

interface IconFlagProps {
  size?: number;
  class?: string;
}

/**
 * Filled flag icon — matches JIRA's "flagged/impediment" indicator.
 * Based on Lucide's `flag` shape, rendered filled instead of stroked
 * to match the solid JIRA flag visual.
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
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      stroke-width="1"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" x2="4" y1="22" y2="15" stroke="currentColor" stroke-width="2" fill="none" />
    </svg>
  );
};
