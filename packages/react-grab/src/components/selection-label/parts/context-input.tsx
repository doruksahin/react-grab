import { onMount } from "solid-js";
import type { Component } from "solid-js";
import { autoResizeTextarea } from "../../../utils/auto-resize-textarea.js";
import {
  IME_COMPOSING_KEY_CODE,
  TEXTAREA_MAX_HEIGHT_PX,
} from "../../../constants.js";
import type { SelectionLabelContextInputProps } from "../types.js";
import { Textarea } from "../../ui/textarea.js";

export const SelectionLabelContextInput: Component<
  SelectionLabelContextInputProps
> = (props) => {
  let inputRef: HTMLTextAreaElement | undefined;

  onMount(() => {
    if (props.autoFocus && inputRef && !props.disabled) {
      inputRef.focus({ preventScroll: true });
    }
  });

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing || event.keyCode === IME_COMPOSING_KEY_CODE) {
      return;
    }

    event.stopImmediatePropagation();

    const isEnterWithoutShift = event.code === "Enter" && !event.shiftKey;
    const isEscape = event.code === "Escape";

    if (isEnterWithoutShift) {
      event.preventDefault();
      props.onSubmit?.();
    } else if (isEscape) {
      event.preventDefault();
      props.onDismiss?.();
    }
  };

  const handleInput = (event: InputEvent) => {
    const inputTarget = event.target;
    if (!(inputTarget instanceof HTMLTextAreaElement)) {
      return;
    }
    autoResizeTextarea(inputTarget, TEXTAREA_MAX_HEIGHT_PX);
    props.onChange?.(inputTarget.value);
  };

  return (
    <div
      data-react-grab-context-input
      class="shrink-0 flex justify-between items-end w-full min-h-4"
    >
      <Textarea
        ref={inputRef}
        data-react-grab-ignore-events
        data-react-grab-generation-input
        variant={props.variant}
        aria-label={props.label}
        style={{ "max-height": `${TEXTAREA_MAX_HEIGHT_PX}px` }}
        value={props.value ?? ""}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={props.placeholder ?? "Add context"}
        rows={1}
        disabled={props.disabled}
        readOnly={!props.onSubmit}
      />
    </div>
  );
};
