import type { Options } from "react-grab";
import type { SiteSettings } from "../settings/types.js";

export type CaptureOptions = Pick<Options, "steps" | "recording">;

/** What the overlay records on a site, from that site's settings (ADR-0025). */
export const captureOptions = (site: SiteSettings | null): CaptureOptions => ({
  steps: { enabled: site?.recordSteps ?? false },
  recording: { enabled: site?.recordSession ?? false },
});
