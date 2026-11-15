import { Show, For } from "solid-js";
import type { Component } from "solid-js";
import type {
  OverlayBounds,
  SelectionLabelStatus,
  ActionCycleState,
  ArrowNavigationState,
  JiraDisplayFields,
} from "../../../types.js";
import type { SelectionGroupsViewProps } from "../../../features/selection-groups/types.js";
import { formatShortcut } from "../../../utils/format-shortcut.js";
import { SelectionLabelRoot } from "../index.js";
import { SelectionLabelHeader } from "../parts/header.js";
import { SelectionLabelContextInput } from "../parts/context-input.js";
import { SelectionLabelComposerHeader } from "../parts/composer-header.js";
import { Kbd } from "../../kbd.js";
import { Button } from "../../ui/button.js";
import { DevInsightsSection } from "../parts/dev-insights-section.js";
import { CopyingState } from "../parts/copying-state.js";
import { DiscardPrompt } from "../discard-prompt.js";
import { ErrorView } from "../error-view.js";
import { ArrowNavigationMenu } from "../arrow-navigation-menu.js";
import { BottomSection } from "../bottom-section.js";
import { ActiveGroupPicker } from "../../selection-groups/active-group-picker.js";

export interface PrimaryLabelProps
  extends
    Pick<
      SelectionGroupsViewProps,
      "groups" | "activeGroupId" | "onActiveGroupChange" | "onAddGroup"
    >,
    JiraDisplayFields {
  tagName?: string;
  componentName?: string;
  elementsCount?: number;
  selectionBounds?: OverlayBounds;
  mouseX?: number;
  visible?: boolean;
  isPromptMode?: boolean;
  inputValue?: string;
  replyToPrompt?: string;
  hasAgent?: boolean;
  status?: SelectionLabelStatus;
  statusText?: string;
  filePath?: string;
  actionCycleState?: ActionCycleState;
  arrowNavigationState?: ArrowNavigationState;
  onArrowNavigationSelect?: (index: number) => void;
  inspectNavigationState?: ArrowNavigationState;
  onInspectSelect?: (index: number) => void;
  onInputChange?: (value: string) => void;
  onSubmit?: () => void;
  onToggleExpand?: () => void;
  onAbort?: () => void;
  onOpen?: () => void;
  isPendingDismiss?: boolean;
  selectionLabelShakeCount?: number;
  onConfirmDismiss?: () => void;
  onCancelDismiss?: () => void;
  isPendingAbort?: boolean;
  onConfirmAbort?: () => void;
  onCancelAbort?: () => void;
  error?: string;
  onAcknowledgeError?: () => void;
  onRetry?: () => void;
  isContextMenuOpen?: boolean;
  onRemoveItem?: () => void;
}

export const PrimaryLabel: Component<PrimaryLabelProps> = (props) => {
  const canInteract = () =>
    props.status !== "copying" &&
    props.status !== "copied" &&
    props.status !== "fading" &&
    props.status !== "error";

  const isArrowNavigationVisible = () =>
    Boolean(props.arrowNavigationState?.isVisible);

  const isInspectNavigationVisible = () =>
    Boolean(props.inspectNavigationState?.isVisible);

  return (
    <SelectionLabelRoot
      selectionBounds={props.selectionBounds}
      mouseX={props.mouseX}
      visible={props.visible}
      status={props.status}
      isPromptMode={props.isPromptMode}
      tagName={props.tagName}
      componentName={props.componentName}
      selectionLabelShakeCount={props.selectionLabelShakeCount}
      onRemoveItem={props.onRemoveItem}
      jiraTicketId={props.jiraTicketId}
      jiraFlagged={props.jiraFlagged}
      onAbort={props.onAbort}
      onAcknowledgeError={props.onAcknowledgeError}
      onRetry={props.onRetry}
      arrowNavigationState={props.arrowNavigationState}
      inspectNavigationState={props.inspectNavigationState}
      onToggleExpand={props.onToggleExpand}
      error={props.error}
      isPendingAbort={props.isPendingAbort}
      hasAgent={props.hasAgent}
      statusText={props.statusText}
    >
      {/* Mode 1: Copying (spinner + disabled textarea + abort) */}
      <Show when={props.status === "copying" && !props.isPendingAbort}>
        <CopyingState
          statusText={props.statusText}
          inputValue={props.inputValue}
          hasAgent={props.hasAgent}
          onAbort={props.onAbort}
        />
      </Show>

      {/* Mode 2: Pending abort */}
      <Show when={props.status === "copying" && props.isPendingAbort}>
        <DiscardPrompt
          onConfirm={props.onConfirmAbort}
          onCancel={props.onCancelAbort}
        />
      </Show>

      {/* Mode 3: Hover mode (action cycle + arrow navigation) */}
      <Show when={canInteract() && !props.isPromptMode}>
        <div
          class="contain-layout shrink-0 flex flex-col items-stretch w-[320px] max-h-[400px] overflow-y-auto overflow-x-hidden"
          style={{ "scrollbar-width": "none" }}
        >
          <SelectionLabelHeader
            tagName={props.tagName}
            componentName={props.componentName}
            elementsCount={props.elementsCount}
            filePath={props.filePath}
            inputValue={props.inputValue}
            onOpen={props.onOpen}
            isContextMenuOpen={props.isContextMenuOpen}
            compactPadding={
              isArrowNavigationVisible() || isInspectNavigationVisible()
            }
          />
          <Show when={props.arrowNavigationState?.isVisible}>
            <ArrowNavigationMenu
              items={props.arrowNavigationState!.items}
              activeIndex={props.arrowNavigationState!.activeIndex}
              onSelect={(index) => props.onArrowNavigationSelect?.(index)}
            />
          </Show>
          <Show
            when={
              !isArrowNavigationVisible() &&
              isInspectNavigationVisible() &&
              props.inspectNavigationState
            }
          >
            {(state) => (
              <ArrowNavigationMenu
                items={state().items}
                activeIndex={state().activeIndex}
                onSelect={(index) => props.onInspectSelect?.(index)}
              />
            )}
          </Show>
          <Show
            when={
              !isArrowNavigationVisible() &&
              !isInspectNavigationVisible() &&
              Boolean(props.actionCycleState?.isVisible)
            }
          >
            <BottomSection>
              <div class="flex flex-col w-[calc(100%+16px)] -mx-2 -my-1.5">
                <For each={props.actionCycleState?.items ?? []}>
                  {(item, itemIndex) => (
                    <div
                      data-react-grab-action-cycle-item={item.label.toLowerCase()}
                      class="contain-layout flex items-center justify-between w-full px-2 py-1 transition-colors"
                      classList={{
                        "bg-accent":
                          itemIndex() ===
                          (props.actionCycleState?.activeIndex ?? 0),
                        "rounded-b-[6px]":
                          itemIndex() ===
                          (props.actionCycleState?.items ?? []).length - 1,
                      }}
                    >
                      <span class="text-body leading-4 font-medium text-popover-foreground">
                        {item.label}
                      </span>
                      <Show when={item.shortcut}>
                        <span class="text-meta text-muted-foreground ml-4">
                          {formatShortcut(item.shortcut!)}
                        </span>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </BottomSection>
          </Show>
        </div>
      </Show>

      {/* Mode 4: Prompt mode — the comment composer */}
      <Show
        when={canInteract() && props.isPromptMode && !props.isPendingDismiss}
      >
        <div class="contain-layout flex w-[320px] shrink-0 flex-col items-stretch">
          <SelectionLabelComposerHeader
            tagName={props.tagName}
            componentName={props.componentName}
            elementsCount={props.elementsCount}
            filePath={props.filePath}
            onOpen={props.onOpen}
            onClose={props.onConfirmDismiss}
            jiraFlagged={props.jiraFlagged}
            jiraFlaggedAt={props.jiraFlaggedAt}
            jiraFlaggedBy={props.jiraFlaggedBy}
            jiraFlaggedByAvatar={props.jiraFlaggedByAvatar}
          />
          <div class="px-3.5 py-2.5">
            <SelectionLabelContextInput
              variant="field"
              label="Comment"
              placeholder="Add a comment"
              value={props.inputValue}
              onChange={props.onInputChange}
              onSubmit={props.onSubmit}
              onDismiss={props.onConfirmDismiss}
              autoFocus
            />
          </div>
          <div
            data-react-grab-composer-footer
            class="flex items-center gap-2 border-t border-border bg-muted/40 py-2.5 pr-3.5 pl-1.5 rounded-b-[10px]"
          >
            <ActiveGroupPicker
              groups={props.groups}
              activeGroupId={props.activeGroupId}
              onActiveGroupChange={props.onActiveGroupChange}
              onAddGroup={props.onAddGroup}
            >
              <ActiveGroupPicker.Trigger
                variant="outline"
                size="xs"
                class="mx-0 h-7 px-2.5 text-caption leading-none"
              />
              <ActiveGroupPicker.Content />
            </ActiveGroupPicker>
            <span class="flex-1" />
            <Kbd>↵</Kbd>
            <Button
              data-react-grab-ignore-events
              data-react-grab-generation-submit
              variant="inverse"
              size="xs"
              class="h-7 px-3 text-body"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                props.onSubmit?.();
              }}
            >
              Save
            </Button>
          </div>
          <DevInsightsSection
            tagName={props.tagName}
            componentName={props.componentName}
          />
        </div>
      </Show>

      {/* Mode 5: Pending dismiss */}
      <Show when={props.isPendingDismiss}>
        <DiscardPrompt
          onConfirm={props.onConfirmDismiss}
          onCancel={props.onCancelDismiss}
        />
      </Show>

      {/* Mode 6: Error */}
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
