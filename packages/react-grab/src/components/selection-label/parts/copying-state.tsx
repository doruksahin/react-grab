import { Show } from "solid-js";
import type { Component } from "solid-js";
import { TEXTAREA_MAX_HEIGHT_PX } from "../../../constants.js";
import { BottomSection } from "../bottom-section.js";
import { IconLoader } from "../../icons/icon-loader.js";

export interface CopyingStateProps {
  statusText?: string;
  inputValue?: string;
  hasAgent?: boolean;
  onAbort?: () => void;
}

export const CopyingState: Component<CopyingStateProps> = (props) => {
  const hasInputValue = () => Boolean(props.hasAgent && props.inputValue);

  return (
    <div
      class="contain-layout shrink-0 flex flex-col justify-center items-start w-fit h-fit max-w-[280px]"
      classList={{ "min-w-[150px]": hasInputValue() }}
    >
      <div class="contain-layout shrink-0 flex items-center gap-1 py-1.5 px-2 w-full h-fit">
        <IconLoader size={13} class="text-muted-foreground shrink-0" />
        <span class="shimmer-text text-[13px] leading-4 font-medium h-fit tabular-nums overflow-hidden text-ellipsis whitespace-nowrap">
          {props.statusText ?? "Grabbing\u2026"}
        </span>
      </div>
      <Show when={hasInputValue()}>
        <BottomSection>
          <div class="shrink-0 flex justify-between items-end w-full min-h-4">
            <textarea
              data-react-grab-ignore-events
              class="text-popover-foreground text-[13px] leading-4 font-medium bg-transparent border-none outline-none resize-none flex-1 p-0 m-0 opacity-50 wrap-break-word overflow-y-auto"
              style={{
                "field-sizing": "content",
                "min-height": "16px",
                "max-height": `${TEXTAREA_MAX_HEIGHT_PX}px`,
                "scrollbar-width": "none",
              }}
              value={props.inputValue ?? ""}
              placeholder="Add context"
              rows={1}
              disabled
            />
            <Show when={props.onAbort}>
              <button
                data-react-grab-ignore-events
                data-react-grab-generation-abort
                class="contain-layout shrink-0 flex items-center justify-center size-4 rounded-full bg-popover-foreground cursor-pointer ml-1 interactive-scale"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  props.onAbort?.();
                }}
              >
                <div class="size-1.5 bg-popover rounded-[1px]" />
              </button>
            </Show>
          </div>
        </BottomSection>
      </Show>
    </div>
  );
};
