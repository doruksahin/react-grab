import { Toast, toaster } from "@kobalte/core/toast";
import { type Component, Show } from "solid-js";
import { TOAST_DURATION_MS } from "../../constants.js";
import { Button } from "./button.js";

export interface ToastAction {
  label: string;
  onSelect: () => void;
}

export interface ShowToastOptions {
  title: string;
  action?: ToastAction;
}

/**
 * Where toasts appear (Kobalte Toast): above the toolbar, in the overlay's
 * shadow root. Mount it once.
 */
export const ToastRegion: Component = () => (
  // F8 moves focus to the toasts, as in Radix. Kobalte's default (Alt+T)
  // clashes with typing in the host page, and an empty list would match
  // every key press.
  <Toast.Region
    duration={TOAST_DURATION_MS}
    swipeDirection="down"
    hotkey={["F8"]}
    aria-label="React Grab notifications"
  >
    <Toast.List
      data-react-grab-ignore-events
      data-react-grab-toast-list
      class="pointer-events-auto fixed bottom-20 left-1/2 z-(--z-dropdown) flex -translate-x-1/2 flex-col gap-2 outline-none"
    />
  </Toast.Region>
);

/** Shows a short message, with an optional action such as Undo. */
export const showToast = (options: ShowToastOptions): number =>
  toaster.show((props) => (
    <Toast
      toastId={props.toastId}
      data-react-grab-toast
      class="flex min-w-[240px] items-center gap-3 rounded-md bg-popover-foreground px-3 py-2 text-caption text-popover shadow-md data-[opened]:animate-in data-[opened]:fade-in-0 data-[closed]:animate-out data-[closed]:fade-out-0"
    >
      <Toast.Title class="flex-1">{options.title}</Toast.Title>
      <Show when={options.action}>
        {(action) => (
          <Button
            data-react-grab-toast-action
            type="button"
            variant="inverse"
            size="xs"
            class="font-semibold underline"
            onClick={() => {
              action().onSelect();
              toaster.dismiss(props.toastId);
            }}
          >
            {action().label}
          </Button>
        )}
      </Show>
    </Toast>
  ));
