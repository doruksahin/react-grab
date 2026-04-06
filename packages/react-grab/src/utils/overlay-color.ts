import { supportsDisplayP3 } from "./supports-display-p3.js";

const isWideGamut = supportsDisplayP3();
const SRGB_COMPONENTS = "210, 57, 192";
const P3_COMPONENTS = "0.84 0.19 0.78";

export const overlayColor = (alpha: number): string =>
  isWideGamut
    ? `color(display-p3 ${P3_COMPONENTS} / ${alpha})`
    : `rgba(${SRGB_COMPONENTS}, ${alpha})`;

/** Convert hex color to rgba string */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const ACTIVE_GROUP_COLORS = { srgb: "56, 189, 248", p3: "0.22 0.74 0.97" };

export const activeGroupOverlayColor = (alpha: number): string =>
  isWideGamut
    ? `color(display-p3 ${ACTIVE_GROUP_COLORS.p3} / ${alpha})`
    : `rgba(${ACTIVE_GROUP_COLORS.srgb}, ${alpha})`;
