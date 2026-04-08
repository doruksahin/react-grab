import { type Component, type ComponentProps, createContext, useContext, createSignal, type Accessor, Show } from "solid-js";
import { cn } from "../../utils/cn.js";

interface DialogContextValue {
  open: Accessor<boolean>;
  setOpen: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextValue>();

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
  children?: any;
}

const Dialog: Component<DialogProps> = (props) => {
  const [internalOpen, setInternalOpen] = createSignal(props.open ?? false);
  const open = () => props.open ?? internalOpen();
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    props.onOpenChange?.(value);
  };
  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {props.children}
    </DialogContext.Provider>
  );
};

const DialogTrigger: Component<ComponentProps<"button">> = (props) => {
  const ctx = useContext(DialogContext);
  return <button {...props} onClick={() => ctx?.setOpen(true)} />;
};

const DialogPortal: Component<{ children?: any }> = (props) => {
  return <>{props.children}</>;
};

const DialogOverlay: Component<ComponentProps<"div">> = (props) => {
  const [local, rest] = (() => {
    const { class: cls, ...r } = props as any;
    return [{ class: cls }, r];
  })();
  return (
    <div
      class={cn("fixed inset-0 bg-black/80", local.class)}
      {...rest}
    />
  );
};

const DialogContent: Component<ComponentProps<"div">> = (props) => {
  const ctx = useContext(DialogContext);
  const [local, rest] = (() => {
    const { class: cls, children, ...r } = props as any;
    return [{ class: cls, children }, r];
  })();
  return (
    <Show when={ctx?.open()}>
      <DialogPortal>
        <DialogOverlay onClick={() => ctx?.setOpen(false)} />
        <div
          class={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
            local.class,
          )}
          role="dialog"
          aria-modal="true"
          {...rest}
        >
          {local.children}
          <button
            class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
            onClick={() => ctx?.setOpen(false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </DialogPortal>
    </Show>
  );
};

const DialogHeader: Component<ComponentProps<"div">> = (props) => {
  const [local, rest] = (() => {
    const { class: cls, ...r } = props as any;
    return [{ class: cls }, r];
  })();
  return (
    <div class={cn("flex flex-col space-y-1.5 text-center sm:text-left", local.class)} {...rest} />
  );
};

const DialogFooter: Component<ComponentProps<"div">> = (props) => {
  const [local, rest] = (() => {
    const { class: cls, ...r } = props as any;
    return [{ class: cls }, r];
  })();
  return (
    <div class={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", local.class)} {...rest} />
  );
};

const DialogTitle: Component<ComponentProps<"h2">> = (props) => {
  const [local, rest] = (() => {
    const { class: cls, ...r } = props as any;
    return [{ class: cls }, r];
  })();
  return (
    <h2 class={cn("text-lg font-semibold leading-none tracking-tight", local.class)} {...rest} />
  );
};

const DialogDescription: Component<ComponentProps<"p">> = (props) => {
  const [local, rest] = (() => {
    const { class: cls, ...r } = props as any;
    return [{ class: cls }, r];
  })();
  return (
    <p class={cn("text-sm text-muted-foreground", local.class)} {...rest} />
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
