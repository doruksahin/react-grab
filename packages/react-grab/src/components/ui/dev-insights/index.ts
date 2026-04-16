import { DevInsightsShell } from "./dev-insights.jsx";
import { DevInsightsField } from "./dev-insights-field.jsx";
import { DevInsightsSection } from "./dev-insights-section.jsx";
import { DevInsightsAttributes } from "./dev-insights-attributes.jsx";

export type { DevInsightsShellProps } from "./dev-insights.jsx";
export type { DevInsightsFieldProps } from "./dev-insights-field.jsx";
export type { DevInsightsSectionProps } from "./dev-insights-section.jsx";
export type { DevInsightsAttributesProps } from "./dev-insights-attributes.jsx";

export const DevInsights = Object.assign(DevInsightsShell, {
  Field: DevInsightsField,
  Section: DevInsightsSection,
  Attributes: DevInsightsAttributes,
});
