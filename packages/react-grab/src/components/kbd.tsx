import type { Component, JSX } from "solid-js";

export const Kbd: Component<{ children: JSX.Element }> = (props) => (
  <kbd class="inline-flex items-center justify-center px-[3px] h-3.5 rounded-sm [border-width:0.5px] border-solid border-border text-popover-foreground text-[10px] font-medium leading-none">
    {props.children}
  </kbd>
);
