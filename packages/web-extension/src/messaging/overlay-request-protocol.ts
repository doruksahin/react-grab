import type { ToolbarState } from "react-grab";
import type { JiraPort, StorageAdapter } from "react-grab/sync-http";
import type { JiraUserIdentity, SiteSettings } from "../settings/types.js";
import type { OverlayState } from "../types.js";
import {
  JIRA_METHODS,
  type PortRequests,
  STORAGE_METHODS,
  portMethodNames,
  portRequestName,
} from "./port-requests.js";

export interface OverlayStateRequests {
  getOverlayState(): OverlayState;
  saveToolbarState(toolbarState: ToolbarState): void;
  getSiteSettings(): SiteSettings | null;
  /** Who the user's own Jira token signs in as, without the token (ADR-0031). */
  getJiraUser(): JiraUserIdentity | null;
}

export interface OverlayRequestProtocol
  extends
    OverlayStateRequests,
    PortRequests<"storage", StorageAdapter>,
    PortRequests<"jira", JiraPort> {}

const OVERLAY_STATE_REQUESTS: Record<keyof OverlayStateRequests, true> = {
  getOverlayState: true,
  saveToolbarState: true,
  getSiteSettings: true,
  getJiraUser: true,
};

export const OVERLAY_REQUEST_NAMES: ReadonlyArray<
  keyof OverlayRequestProtocol
> = [
  ...portMethodNames<OverlayStateRequests>(OVERLAY_STATE_REQUESTS),
  ...portMethodNames<StorageAdapter>(STORAGE_METHODS).map((method) =>
    portRequestName("storage", method),
  ),
  ...portMethodNames<JiraPort>(JIRA_METHODS).map((method) =>
    portRequestName("jira", method),
  ),
];
