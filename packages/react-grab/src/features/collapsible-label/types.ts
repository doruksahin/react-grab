import type { Accessor } from "solid-js";

export interface CollapsibleLabelConfig {
  instanceId: string;
  defaultCollapsed?: boolean;
}

export interface CollapsibleLabelAPI {
  isCollapsed: Accessor<boolean>;
  collapse: () => void;
  expand: () => void;
  toggle: () => void;
}
