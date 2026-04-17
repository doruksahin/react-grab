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
import type {
  SubmitCommentFn,
  SearchJiraUsersFn,
} from "../../../features/jira-comments/types.js";
import { formatShortcut } from "../../../utils/format-shortcut.js";
import { SelectionLabelRoot } from "../index.js";
import { SelectionLabelHeader } from "../parts/header.js";
import { SelectionLabelContent } from "../parts/content.js";
import { SelectionLabelContextInput } from "../parts/context-input.js";
import { DevInsightsSection } from "../parts/dev-insights-section.js";
import { CopyingState } from "../parts/copying-state.js";
import { DiscardPrompt } from "../discard-prompt.js";
import { ErrorView } from "../error-view.js";
import { ArrowNavigationMenu } from "../arrow-navigation-menu.js";
import { BottomSection } from "../bottom-section.js";
import { SelectionCardBody } from "../../sidebar/selection-card-body.js";
import { CreateTicketButton } from "../create-ticket-button.js";
import { ActiveGroupPicker } from "../../../features/selection-groups/components/active-group-picker.js";

export interface PrimaryLabelProps
  extends Pick<
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
  onCreateTicket?: () => void;
  itemId?: string;
  timestamp?: number;
  syncServerUrl?: string;
  syncWorkspace?: string;
  onSubmitJiraComment?: SubmitCommentFn;
  onSearchJiraUsers?: SearchJiraUsersFn;
  onRefreshJiraStatus?: () => void;
  commentEditorToolbarVisible?: boolean;
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
                      <span class="text-[13px] leading-4 font-medium text-popover-foreground">
                        {item.label}
                      </span>
                      <Show when={item.shortcut}>
                        <span class="text-[11px] text-muted-foreground ml-4">
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

      {/* Mode 4: Prompt mode (JIRA card + context input + dev insights) */}
      <Show
        when={canInteract() && props.isPromptMode && !props.isPendingDismiss}
      >
        <div class="contain-layout shrink-0 flex flex-col justify-center items-start min-w-[150px] max-w-[280px] gap-1">
          <SelectionLabelHeader
            tagName={props.tagName}
            componentName={props.componentName}
            elementsCount={props.elementsCount}
            filePath={props.filePath}
            inputValue={props.inputValue}
            onOpen={props.onOpen}
            isContextMenuOpen={props.isContextMenuOpen}
            jiraFlagged={props.jiraFlagged}
            jiraFlaggedAt={props.jiraFlaggedAt}
            jiraFlaggedBy={props.jiraFlaggedBy}
            jiraFlaggedByAvatar={props.jiraFlaggedByAvatar}
            trailing={
              <ActiveGroupPicker
                groups={props.groups}
                activeGroupId={props.activeGroupId}
                onActiveGroupChange={props.onActiveGroupChange}
                onAddGroup={props.onAddGroup}
              >
                <ActiveGroupPicker.Trigger />
                <ActiveGroupPicker.Content />
              </ActiveGroupPicker>
            }
          />
          <SelectionLabelContent>
            <SelectionCardBody
              timestamp={props.timestamp}
              itemId={props.itemId}
              syncServerUrl={props.syncServerUrl}
              syncWorkspace={props.syncWorkspace}
              jiraTicketId={props.jiraTicketId}
              jiraUrl={props.jiraUrl}
              jiraStatus={props.groupStatus}
              jiraStatusCategory={props.jiraStatusCategory}
              jiraLabels={props.jiraLabels}
              jiraDueDate={props.jiraDueDate}
              jiraIssueType={props.jiraIssueType}
              jiraPriority={props.jiraPriority}
              jiraAssignee={props.jiraAssignee}
              jiraAssigneeAvatar={props.jiraAssigneeAvatar}
              jiraComments={props.jiraComments}
              onSubmitComment={props.onSubmitJiraComment}
              onSearchUsers={props.onSearchJiraUsers}
              onRefreshStatus={
                props.onRefreshJiraStatus
                  ? () => props.onRefreshJiraStatus?.()
                  : undefined
              }
              noTicketAction={
                canInteract() && props.onCreateTicket && !props.jiraTicketId
                  ? (
                      <CreateTicketButton
                        onClick={() => props.onCreateTicket?.()}
                        class="w-full"
                      />
                    )
                  : undefined
              }
            />
          </SelectionLabelContent>
          <SelectionLabelContextInput
            value={props.inputValue}
            onChange={props.onInputChange}
            onSubmit={props.onSubmit}
            onDismiss={props.onConfirmDismiss}
            autoFocus
          />
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
