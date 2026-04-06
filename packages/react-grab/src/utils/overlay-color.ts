import { supportsDisplayP3 } from "./supports-display-p3.js";
import type { GroupStatus } from "../types.js";

const isWideGamut = supportsDisplayP3();
const SRGB_COMPONENTS = "210, 57, 192";
const P3_COMPONENTS = "0.84 0.19 0.78";

export const overlayColor = (alpha: number): string =>
  isWideGamut
    ? `color(display-p3 ${P3_COMPONENTS} / ${alpha})`
    : `rgba(${SRGB_COMPONENTS}, ${alpha})`;

const STATUS_COLORS: Record<
  GroupStatus,
  { srgb: string; p3: string }
> = {
  open: { srgb: "210, 57, 192", p3: "0.84 0.19 0.78" },
  ticketed: { srgb: "234, 179, 8", p3: "0.92 0.70 0.03" },
  resolved: { srgb: "34, 197, 94", p3: "0.13 0.77 0.37" },
};

export const statusOverlayColor = (
  status: GroupStatus,
  alpha: number,
): string => {
  const c = STATUS_COLORS[status];
  return isWideGamut
    ? `color(display-p3 ${c.p3} / ${alpha})`
    : `rgba(${c.srgb}, ${alpha})`;
};
