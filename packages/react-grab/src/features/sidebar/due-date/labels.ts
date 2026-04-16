/**
 * Due-date filter — UI label layer.
 *
 * Visible-string mapping for each preset, plus the "no preset selected"
 * placeholder. Decoupled from ./presets.ts so server-side code (which has
 * no need for human-facing labels) doesn't pull this in.
 */

import type { DueDatePreset } from "./presets.js";

export const DUE_DATE_PRESET_LABEL: Readonly<Record<DueDatePreset, string>> = {
  overdue:     "Overdue",
  today:       "Due today",
  "this-week": "This week",
  "next-7":    "Next 7 days",
  none:        "No due date",
} as const;

/** Placeholder text on the FilterBar Select when no preset is active. */
export const DUE_DATE_PRESET_LABEL_ALL = "All due dates";

/**
 * Resolve the trigger / option label from a Select option's raw string value.
 * The Select uses "" to represent "no preset selected".
 */
export const dueDatePresetLabel = (rawValue: string): string => {
  if (rawValue === "") return DUE_DATE_PRESET_LABEL_ALL;
  return DUE_DATE_PRESET_LABEL[rawValue as DueDatePreset] ?? rawValue;
};
