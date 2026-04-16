import { createSignal } from "solid-js";
import type { CollapsibleLabelAPI, CollapsibleLabelConfig } from "./types.js";

export const useCollapsibleLabel = (
  config: CollapsibleLabelConfig,
): CollapsibleLabelAPI => {
  const [isCollapsed, setIsCollapsed] = createSignal(
    config.defaultCollapsed ?? false,
  );

  return {
    isCollapsed,
    collapse: () => setIsCollapsed(true),
    expand: () => setIsCollapsed(false),
    toggle: () => setIsCollapsed((prev) => !prev),
  };
};
