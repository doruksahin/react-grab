import { defineContentScript } from "wxt/utils/define-content-script";
import { startRelay } from "../relay/start-relay.js";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main: startRelay,
});
