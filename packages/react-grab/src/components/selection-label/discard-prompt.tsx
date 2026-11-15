import { onMount, onCleanup } from "solid-js";
import type { Component } from "solid-js";
import type { DiscardPromptProps } from "../../types.js";
import { confirmationFocusManager } from "../../utils/confirmation-focus-manager.js";
import { isKeyboardEventTriggeredByInput } from "../../utils/is-keyboard-event-triggered-by-input.js";
import { IconReturn } from "../icons/icon-return.jsx";
import { BottomSection } from "./bottom-section.js";
import { Button } from "../ui/button.js";

export const DiscardPrompt: Component<DiscardPromptProps> = (props) => {
  const instanceId = Symbol();

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!confirmationFocusManager.isActive(instanceId)) return;
    if (isKeyboardEventTriggeredByInput(event)) return;

    const isEnter = event.code === "Enter";
    const isEscape = event.code === "Escape";
    if (isEnter || isEscape) {
      event.preventDefault();
      event.stopPropagation();
      if (isEscape && props.cancelOnEscape) {
        props.onCancel?.();
      } else {
        props.onConfirm?.();
      }
    }
  };

  const handleFocus = () => {
    confirmationFocusManager.claim(instanceId);
  };

  onMount(() => {
    confirmationFocusManager.claim(instanceId);
    window.addEventListener("keydown", handleKeyDown, { capture: true });
  });

  onCleanup(() => {
    confirmationFocusManager.release(instanceId);
    window.removeEventListener("keydown", handleKeyDown, { capture: true });
  });

  return (
    <div
      data-react-grab-discard-prompt
      class="contain-layout shrink-0 flex flex-col justify-center items-end w-fit h-fit"
      onPointerDown={handleFocus}
      onClick={handleFocus}
    >
      <div class="contain-layout shrink-0 flex items-center gap-1 pt-1.5 pb-1 px-2 w-full h-fit">
        <span class="text-popover-foreground text-body leading-4 shrink-0 font-medium w-fit h-fit">
          {props.label ?? "Discard?"}
        </span>
      </div>
      <BottomSection>
        <div class="contain-layout shrink-0 flex items-center justify-end gap-[5px] w-full h-fit">
          <Button
            data-react-grab-discard-no
            variant="chip"
            size="chip"
            class="shrink-0"
            onClick={props.onCancel}
          >
            No
          </Button>
          <Button
            data-react-grab-discard-yes
            variant="chip-destructive"
            size="chip"
            class="shrink-0"
            onClick={props.onConfirm}
          >
            Yes
            <IconReturn size={10} class="text-destructive/50" />
          </Button>
        </div>
      </BottomSection>
    </div>
  );
};
