import { Show } from "solid-js";
import type { Component } from "solid-js";
import { autoResizeTextarea } from "../../../utils/auto-resize-textarea.js";
import { IconSubmit } from "../../icons/icon-submit.js";
import { IME_COMPOSING_KEY_CODE, TEXTAREA_MAX_HEIGHT_PX } from "../../../constants.js";
import { BottomSection } from "../bottom-section.js";
import type { SelectionLabelContextInputProps } from "../types.js";

export const SelectionLabelContextInput: Component<
  SelectionLabelContextInputProps
> = (props) => {
  let inputRef: HTMLTextAreaElement | undefined;

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
    <BottomSection>
      <div data-react-grab-context-input class="shrink-0 flex justify-between items-end w-full min-h-4">
        <textarea
          ref={inputRef}
          data-react-grab-ignore-events
          data-react-grab-generation-input
          class="text-popover-foreground text-[13px] leading-4 font-medium bg-transparent border-none outline-none resize-none flex-1 p-0 m-0 wrap-break-word overflow-y-auto"
          classList={{
            "opacity-50": Boolean(props.disabled),
          }}
          style={{
            "field-sizing": "content",
            "min-height": "16px",
            "max-height": `${TEXTAREA_MAX_HEIGHT_PX}px`,
            "scrollbar-width": "none",
          }}
          value={props.value ?? ""}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={props.placeholder ?? "Add context"}
          rows={1}
          disabled={props.disabled}
          readOnly={!props.onSubmit}
        />
        <Show when={props.onSubmit && !props.disabled}>
          <button
            data-react-grab-ignore-events
            data-react-grab-generation-submit
            class="contain-layout shrink-0 flex items-center justify-center size-4 rounded-full bg-popover-foreground cursor-pointer ml-1 interactive-scale"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              props.onSubmit?.();
            }}
          >
            <IconSubmit size={10} class="text-popover" />
          </button>
        </Show>
      </div>
    </BottomSection>
  );
};
