/**
 * BUSINESS RULE: Display Color Resolution
 *
 * This module encodes the enterprise color-override precedence for selection
 * groups. It is the SINGLE source of truth for "what color should this group
 * display as?" — UI components must call resolveDisplayColor() instead of
 * calling getStatusColor() directly when the result is a visual indicator.
 *
 * Override chain (highest priority wins):
 *   1. Flagged / Blocked  →  red-600 (#dc2626)
 *   2. ATT JIRA Status    →  status-colors.ts lookup
 *   3. Default (no task)  →  grab-pink (#b21c8e)
 *
 * WHY: Flagged issues represent impediments that block team velocity.
 * A blocked ticket MUST scream visually — its "blocked" state is more
 * important than its workflow position. A ticket can be "In Progress"
 * and flagged at the same time; the flag wins because knowing it's
 * blocked is actionable, knowing it's in-progress is not.
 *
 * CONSUMERS:
 *   - overlay-canvas.tsx     (canvas border + fill color)
 *   - selection-label/       (label border)
 *   - sidebar/status-legend  (legend display)
 *   - Any future component that renders group color
 */

import { type StatusColorConfig, getStatusColor } from "./status-colors.js";

// ── Flagged Color ──────────────────────────────────────────────────────
// Red-600: distinct from "Won't Do" red-500 (#ef4444).
// Decided in ADR-0009: decree/adr/0009-flag-data-source-and-blocked-visual-strategy.md
export const FLAGGED_COLOR: StatusColorConfig = {
  hex: "#dc2626",
  bg: "rgba(220,38,38,0.12)",
  text: "#dc2626",
};

// ── Business Rule ──────────────────────────────────────────────────────

/**
 * Resolve the display color for a selection group.
 *
 * This is the ONLY function UI components should call to determine
 * a group's visual color. It applies the override chain documented above.
 *
 * @param jiraStatus  - The ATT workflow status name (e.g. "In Progress")
 * @param jiraFlagged - Whether the JIRA ticket is flagged (blocked)
 * @returns The resolved StatusColorConfig
 */
export function resolveDisplayColor(
  jiraStatus: string | undefined,
  jiraFlagged: boolean | undefined,
): StatusColorConfig {
  // Rule: Flagged overrides status. Always.
  if (jiraFlagged) return FLAGGED_COLOR;

  return getStatusColor(jiraStatus);
}
