import { Show } from "solid-js";
import type { Component } from "solid-js";
import type { OverlayBounds, SelectionLabelStatus } from "../../../types.js";
import { SelectionLabelRoot } from "../index.js";
import { CopyingState } from "../parts/copying-state.js";
import { DiscardPrompt } from "../discard-prompt.js";
import { ErrorView } from "../error-view.js";

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
        <CopyingState
          statusText={props.statusText ?? "Generating\u2026"}
          inputValue={props.inputValue}
          hasAgent={true}
          onAbort={props.onAbort}
        />
      </Show>

      <Show when={isCopyingPendingAbort()}>
        <DiscardPrompt
          onConfirm={props.onConfirmAbort}
          onCancel={props.onCancelAbort}
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
