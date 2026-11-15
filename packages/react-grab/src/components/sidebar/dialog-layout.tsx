import { type Component, type JSXElement, Show } from "solid-js";
import { IconX } from "../icons/icon-x.js";
import { IconButton } from "../ui/icon-button.js";

interface DialogHeaderProps {
  title: string;
  /** A line under the title, e.g. where the result goes. */
  subtitle?: JSXElement;
  onClose: () => void;
}

export const DialogHeader: Component<DialogHeaderProps> = (props) => {
  return (
    <div class="flex items-start gap-2.5">
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <h2 class="text-heading leading-6 font-semibold text-foreground">
          {props.title}
        </h2>
        <Show when={props.subtitle}>
          <p class="text-caption text-muted-foreground">{props.subtitle}</p>
        </Show>
      </div>
      <IconButton
        type="button"
        label="Close dialog"
        size="icon-md"
        onClick={props.onClose}
        style={{ "pointer-events": "auto" }}
      >
        <IconX size={14} />
      </IconButton>
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
    <div class="flex max-h-[80vh] flex-col">
      <div class="shrink-0 border-b border-border px-5 pt-4.5 pb-3.5">
        {props.header}
      </div>
      <div class="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-4.5">
        {props.children}
      </div>
      <div class="shrink-0 border-t border-border px-5 py-3.5">
        {props.footer}
      </div>
    </div>
  );
};
