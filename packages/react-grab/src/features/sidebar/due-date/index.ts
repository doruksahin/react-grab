/**
 * Due-date filter — barrel export.
 *
 * Three independent layers:
 *   - presets.ts  → DueDatePreset union + JQL contract (future-portable)
 *   - labels.ts   → human-facing strings (UI-only)
 *   - matchers.ts → client-side execution against SelectionGroupWithJira
 *
 * Consumers should import the narrowest layer they need. The barrel exists
 * so external code (filter-state, filter-bar, filter-chips) has one stable
 * import path.
 */

export type { DueDatePreset } from "./presets.js";
export {
  DUE_DATE_PRESET_ORDER,
  DUE_DATE_PRESET_JQL,
} from "./presets.js";

export {
  DUE_DATE_PRESET_LABEL,
  DUE_DATE_PRESET_LABEL_ALL,
  dueDatePresetLabel,
} from "./labels.js";

export { matchesDueDatePreset } from "./matchers.js";
