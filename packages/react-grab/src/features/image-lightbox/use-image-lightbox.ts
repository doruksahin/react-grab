import { createSignal } from "solid-js";
import type { LightboxState } from "./types.js";

const [state, setState] = createSignal<LightboxState>({
  open: false,
  src: "",
  caption: "",
});

export const useImageLightbox = () => ({
  state,
  open: (src: string, caption: string) => {
    setState({ open: true, src, caption });
  },
  close: () => {
    setState((prev) => ({ ...prev, open: false }));
  },
});
