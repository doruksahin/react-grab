import type { Component, JSXElement } from "solid-js";
import { Button } from "../ui/button.js";

interface DialogHeaderProps {
  title: string;
  onClose: () => void;
}

export const DialogHeader: Component<DialogHeaderProps> = (props) => {
  return (
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-foreground">{props.title}</h2>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        onClick={props.onClose}
        aria-label="Close dialog"
        style={{ "pointer-events": "auto" }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
        >
          <path fill="currentColor" d="M14.03 3.03 9.06 8l4.97 4.97-1.06 1.06L8 9.06l-4.97 4.97-1.06-1.06L6.94 8 1.97 3.03l1.06-1.06L8 6.94l4.97-4.97z" />
        </svg>
      </Button>
    </div>
  );
};

interface DialogLayoutProps {
  header: JSXElement;
  footer: JSXElement;
  children: JSXElement;
}

export const DialogLayout: Component<DialogLayoutProps> = (props) => {
  return (
    <div class="flex flex-col" style={{ "max-height": "80vh" }}>
      <div class="flex-shrink-0 px-6 py-4 border-b border-border">
        {props.header}
      </div>
      <div class="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        {props.children}
      </div>
      <div class="flex-shrink-0 px-6 py-4 border-t border-border">
        {props.footer}
      </div>
    </div>
  );
};
