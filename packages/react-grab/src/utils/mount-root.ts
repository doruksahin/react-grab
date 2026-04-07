// packages/react-grab/src/utils/mount-root.ts
import { MOUNT_ROOT_RECHECK_DELAY_MS, Z_INDEX_HOST } from "../constants.js";
import { setShadowMount } from "./shadow-context.js";
import { syncColorScheme } from "./sync-color-scheme.js";

const ATTRIBUTE_NAME = "data-react-grab";

const FONT_LINK_ID = "react-grab-fonts";
const FONT_LINK_URL =
  "https://fonts.googleapis.com/css2?family=Geist:wght@500&display=swap";

/**
 * The result of mounting the react-grab shadow DOM host.
 *
 * Both values are returned by mountRoot() so that the creation layer
 * owns the ShadowRoot and can pass it explicitly to ReactGrabRenderer.
 * Nothing downstream should call getRootNode() to recover the shadow root.
 */
export interface ShadowMountResult {
  /** The inner div that Solid.js renders into via render(). */
  root: HTMLDivElement;
  /** The ShadowRoot that isolates all react-grab UI from the host page. */
  shadowRoot: ShadowRoot;
}

const loadFonts = () => {
  if (document.getElementById(FONT_LINK_ID)) return;
  if (!document.head) return;
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = FONT_LINK_URL;
  document.head.appendChild(link);
};


export const mountRoot = (cssText?: string): ShadowMountResult => {
  loadFonts();

  const mountedHost = document.querySelector(`[${ATTRIBUTE_NAME}]`);
  if (mountedHost) {
    const mountedRoot = mountedHost.shadowRoot?.querySelector(
      `[${ATTRIBUTE_NAME}]`,
    );
    if (mountedRoot instanceof HTMLDivElement && mountedHost.shadowRoot) {
      setShadowMount(mountedHost.shadowRoot);
      syncColorScheme(mountedHost);
      return { root: mountedRoot, shadowRoot: mountedHost.shadowRoot };
    }
  }

  const host = document.createElement("div");
  host.setAttribute(ATTRIBUTE_NAME, "true");
  host.style.zIndex = String(Z_INDEX_HOST);
  host.style.position = "fixed";
  host.style.inset = "0";
  // pointer-events: none lets clicks pass through transparent regions of the
  // overlay to the underlying page — essential for a parasitic dev tool. This
  // is inherited by every descendant in the shadow tree, so interactive
  // elements (the sidebar wrapper, all Kobalte portal content) must explicitly
  // opt back in. See styles.css → "SHADOW HOST POINTER-EVENTS OPT-IN FOR
  // KOBALTE PORTALS" for the rule that handles portalled primitives.
  host.style.pointerEvents = "none";
  const shadowRoot = host.attachShadow({ mode: "open" });
  setShadowMount(shadowRoot);

  if (cssText) {
    const styleElement = document.createElement("style");
    styleElement.textContent = cssText;
    shadowRoot.appendChild(styleElement);
  }

  const root = document.createElement("div");
  root.setAttribute(ATTRIBUTE_NAME, "true");
  shadowRoot.appendChild(root);
  // Sync on the host (not the inner root) so :host([data-kb-theme="light"])
  // can inherit tokens through the shadow boundary into BOTH the renderer
  // tree and any Kobalte portals that mount at the shadow root level.
  syncColorScheme(host);

  const doc = document.body ?? document.documentElement;
  // HACK: wait for hydration (in case something blows away the DOM)
  doc.appendChild(host);

  // HACK: re-append after a delay to ensure we're the last child of body.
  // This handles two cases:
  //   1. Hydration blew away the DOM and the host was removed
  //   2. Another tool (e.g. react-scan) appended at the same max z-index —
  //      being last in DOM order wins the stacking tiebreaker
  // appendChild of an existing node is an atomic move (no flash, no reflow).
  setTimeout(() => {
    doc.appendChild(host);
  }, MOUNT_ROOT_RECHECK_DELAY_MS);

  return { root, shadowRoot };
};
