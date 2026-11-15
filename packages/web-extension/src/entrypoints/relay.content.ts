import { defineContentScript } from "wxt/utils/define-content-script";
import { startRelay } from "../relay/start-relay.js";

export default defineContentScript({
  registration: "runtime",
  main: startRelay,
});
