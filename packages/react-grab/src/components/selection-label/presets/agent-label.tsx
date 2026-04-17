import { Show } from "solid-js";
import type { Component } from "solid-js";
import type { OverlayBounds, SelectionLabelStatus } from "../../../types.js";
import { TEXTAREA_MAX_HEIGHT_PX } from "../../../constants.js";
import { SelectionLabelRoot } from "../index.js";
import { CompletionView } from "../completion-view.js";
import { DiscardPrompt } from "../discard-prompt.js";
import { ErrorView } from "../error-view.js";
import { BottomSection } from "../bottom-section.js";
import { IconLoader } from "../../icons/icon-loader.js";

export interface AgentLabelProps {
  tagName?: string;
  componentName?: string;
  selectionBounds?: OverlayBounds;
  mouseX?: number;
  status?: SelectionLabelStatus;
  statusText?: string;
  inputValue?: string;
  previousPrompt?: string;
  supportsUndo?: boolean;
  supportsFollowUp?: boolean;
  dismissButtonText?: string;
  error?: string;
  isPendingAbort?: boolean;
  onAbort?: () => void;
  onConfirmAbort?: () => void;
  onCancelAbort?: () => void;
  onDismiss?: () => void;
  onUndo?: () => void;
  onFollowUpSubmit?: (prompt: string) => void;
  onAcknowledgeError?: () => void;
  onRetry?: () => void;
  onShowContextMenu?: () => void;
}

export const AgentLabel: Component<AgentLabelProps> = (props) => {
  const isCopying = () => props.status === "copying";
  const isCopyingActive = () => isCopying() && !props.isPendingAbort;
  const isCopyingPendingAbort = () => isCopying() && Boolean(props.isPendingAbort);
  const isCompleted = () =>
    props.status === "copied" || props.status === "fading";
  const hasInputValue = () => Boolean(props.inputValue);

  return (
    <SelectionLabelRoot
      selectionBounds={props.selectionBounds}
      mouseX={props.mouseX}
      visible={true}
      status={props.status}
      isPromptMode={false}
      hideArrow={false}
      tagName={props.tagName}
      componentName={props.componentName}
      onDismiss={props.onDismiss}
      onShowContextMenu={props.onShowContextMenu}
      onAbort={props.onAbort}
      onAcknowledgeError={props.onAcknowledgeError}
      onRetry={props.onRetry}
      hasAgent={true}
      statusText={props.statusText}
      supportsUndo={props.supportsUndo}
      supportsFollowUp={props.supportsFollowUp}
      dismissButtonText={props.dismissButtonText}
      previousPrompt={props.previousPrompt}
      onUndo={props.onUndo}
      onFollowUpSubmit={props.onFollowUpSubmit}
      error={props.error}
      isPendingAbort={props.isPendingAbort}
    >
      <Show when={isCopyingActive()}>
        <div
          class="contain-layout shrink-0 flex flex-col justify-center items-start w-fit h-fit max-w-[280px]"
          classList={{ "min-w-[150px]": hasInputValue() }}
        >
          <div class="contain-layout shrink-0 flex items-center gap-1 pt-1.5 px-2 w-full h-fit">
            <IconLoader size={13} class="text-muted-foreground shrink-0" />
            <span class="shimmer-text text-popover-foreground text-[13px] leading-4 font-medium truncate">
              {props.statusText ?? "Generating..."}
            </span>
          </div>
          <Show when={hasInputValue()}>
            <BottomSection>
              <div
                data-react-grab-context-input
                class="shrink-0 flex justify-between items-end w-full min-h-4"
              >
                <textarea
                  data-react-grab-ignore-events
                  data-react-grab-generation-input
                  class="text-popover-foreground text-[13px] leading-4 font-medium bg-transparent border-none outline-none resize-none flex-1 p-0 m-0 wrap-break-word overflow-y-auto opacity-50"
                  style={{
                    "field-sizing": "content",
                    "min-height": "16px",
                    "max-height": `${TEXTAREA_MAX_HEIGHT_PX}px`,
                    "scrollbar-width": "none",
                  }}
                  value={props.inputValue}
                  disabled
                  readOnly
                  rows={1}
                />
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
              </div>
            </BottomSection>
          </Show>
        </div>
      </Show>

      <Show when={isCopyingPendingAbort()}>
        <DiscardPrompt
          onConfirm={props.onConfirmAbort}
          onCancel={props.onCancelAbort}
        />
      </Show>

      <Show when={isCompleted()}>
        <CompletionView
          statusText={props.statusText ?? "Completed"}
          supportsUndo={props.supportsUndo}
          supportsFollowUp={props.supportsFollowUp}
          dismissButtonText={props.dismissButtonText}
          previousPrompt={props.previousPrompt}
          onDismiss={props.onDismiss}
          onUndo={props.onUndo}
          onFollowUpSubmit={props.onFollowUpSubmit}
          onShowContextMenu={props.onShowContextMenu}
        />
      </Show>

      <Show when={props.error}>
        <ErrorView
          error={props.error!}
          onAcknowledge={props.onAcknowledgeError}
          onRetry={props.onRetry}
        />
      </Show>
    </SelectionLabelRoot>
  );
};
