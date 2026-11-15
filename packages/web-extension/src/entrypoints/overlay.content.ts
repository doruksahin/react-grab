import { defineContentScript } from "wxt/utils/define-content-script";
import { startOverlay } from "../overlay/start-overlay.js";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  world: "MAIN",
  main: startOverlay,
});
