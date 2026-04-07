import { Dialog as DialogPrimitive } from "@kobalte/core/dialog";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";
import { useShadowMount } from "../../features/sidebar/shadow-context.js";

// Re-export root and trigger unchanged
const Dialog = DialogPrimitive;
const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal: Component<ComponentProps<typeof DialogPrimitive.Portal>> = (props) => {
  return <DialogPrimitive.Portal {...props} mount={useShadowMount()} />;
};

const DialogOverlay: Component<ComponentProps<typeof DialogPrimitive.Overlay>> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <DialogPrimitive.Overlay
      class={cn(
        "fixed inset-0 z-50 bg-black/80 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0",
        local.class,
      )}
      {...rest}
    />
  );
};

const DialogContent: Component<ComponentProps<typeof DialogPrimitive.Content> & { "data-kb-theme"?: string }> = (props) => {
  const [local, rest] = splitProps(props, ["class", "children", "data-kb-theme"]);
  return (
    // Wrap both overlay and content in the theme div so [data-kb-theme="dark"] covers
    // DialogOverlay too. Overlay is a sibling of Content — placing the attribute only
    // on Content would leave the overlay outside the dark-token cascade.
    <DialogPortal>
      <div data-kb-theme={local["data-kb-theme"]}>
        <DialogOverlay />
        <DialogPrimitive.Content
          class={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 data-[closed]:slide-out-to-left-1/2 data-[closed]:slide-out-to-top-[48%] data-[expanded]:slide-in-from-left-1/2 data-[expanded]:slide-in-from-top-[48%] sm:rounded-lg",
            local.class,
          )}
          {...rest}
        >
          {local.children}
          <DialogPrimitive.CloseButton class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </DialogPrimitive.CloseButton>
        </DialogPrimitive.Content>
      </div>
    </DialogPortal>
  );
};

const DialogHeader: Component<ComponentProps<"div">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div class={cn("flex flex-col space-y-1.5 text-center sm:text-left", local.class)} {...rest} />
  );
};

const DialogFooter: Component<ComponentProps<"div">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div class={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", local.class)} {...rest} />
  );
};

const DialogTitle: Component<ComponentProps<typeof DialogPrimitive.Title>> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <DialogPrimitive.Title
      class={cn("text-lg font-semibold leading-none tracking-tight", local.class)}
      {...rest}
    />
  );
};

const DialogDescription: Component<ComponentProps<typeof DialogPrimitive.Description>> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <DialogPrimitive.Description
      class={cn("text-sm text-muted-foreground", local.class)}
      {...rest}
    />
  );
};

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
