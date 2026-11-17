import { createSignal, onCleanup } from "solid-js";

/** `location.hash`, updated on every link click or back/forward. */
export const useLocationHash = () => {
  const [hash, setHash] = createSignal(window.location.hash);
  const update = () => setHash(window.location.hash);
  window.addEventListener("hashchange", update);
  onCleanup(() => window.removeEventListener("hashchange", update));
  return hash;
};
