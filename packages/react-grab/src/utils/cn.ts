import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The overlay's type steps (styles.css, @theme --text-*, ADR-0022). Without
// them tailwind-merge reads `text-body` as a colour and drops it next to
// `text-muted-foreground`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["meta", "caption", "body", "title", "heading"],
    },
  },
});

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
