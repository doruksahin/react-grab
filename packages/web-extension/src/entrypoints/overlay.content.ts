import { defineContentScript } from "wxt/utils/define-content-script";
import { startOverlay } from "../overlay/start-overlay.js";

export default defineContentScript({
  registration: "runtime",
  world: "MAIN",
  main: startOverlay,
});
