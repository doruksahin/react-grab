import { Show } from "solid-js";
import type { Component } from "solid-js";
import type {
  OverlayBounds,
  SelectionLabelStatus,
  JiraDisplayFields,
} from "../../../types.js";
import type { SelectionGroupWithJira } from "../../../features/selection-groups/types.js";
import { SelectionLabelRoot } from "../index.js";
import { SelectionLabelHeader } from "../parts/header.js";
import { SelectionLabelContent } from "../parts/content.js";
import { DevInsightsSection } from "../parts/dev-insights-section.js";
import { CopyingState } from "../parts/copying-state.js";
import { ErrorView } from "../error-view.js";
import { CreateTicketButton } from "../../jira/create-ticket-button.js";
import { SelectionCardBody } from "../../sidebar/selection-card-body.js";
import { ActiveGroupPicker } from "../../selection-groups/active-group-picker.js";
import { Button } from "../../ui/button.js";

export interface PersistedLabelProps extends JiraDisplayFields {
  tagName?: string;
  componentName?: string;
  elementsCount?: number;
  selectionBounds?: OverlayBounds;
  mouseX?: number;
  status?: SelectionLabelStatus;
  statusText?: string;
  hasAgent?: boolean;
  isPromptMode?: boolean;
  inputValue?: string;
  error?: string;
  hideArrow?: boolean;
  itemId?: string;
  commentText?: string;
  timestamp?: number;
  hasElementScreenshot?: boolean;
  hasFullPageScreenshot?: boolean;

  syncServerUrl?: string;
  syncWorkspace?: string;

  groups: SelectionGroupWithJira[];
  activeGroupId?: string | null;
  onActiveGroupChange?: (groupId: string | null) => void;
  onAddGroup?: (name: string) => void;

  onRemoveItem?: () => void;
  onCreateTicket?: () => void;
  onShowContextMenu?: () => void;
  onHoverChange?: (isHovered: boolean) => void;

  onRefreshJiraStatus?: () => void;
  /** Opens the sidebar on this selection, where its Jira thread lives. */
  onOpenThread?: () => void;

  isCollapsing?: boolean;
  onCollapse?: () => void;
  extraTopOffset?: number;
  onPlacementChange?: (placement: "above" | "below") => void;
}

export const PersistedLabel: Component<PersistedLabelProps> = (props) => {
  const isCopying = () => props.status === "copying";
  const comments = () => props.jiraComments ?? [];
  const latestComment = () => comments()[comments().length - 1];

  return (
    <SelectionLabelRoot
      selectionBounds={props.selectionBounds}
      mouseX={props.mouseX}
      visible={true}
      status={props.status}
      isPromptMode={true}
      hideArrow={props.hideArrow}
      extraTopOffset={props.extraTopOffset}
      onPlacementChange={props.onPlacementChange}
      isCollapsing={props.isCollapsing}
      onCollapse={props.onCollapse}
      tagName={props.tagName}
      componentName={props.componentName}
      onRemoveItem={props.onRemoveItem}
      jiraTicketId={props.jiraTicketId}
      jiraFlagged={props.jiraFlagged}
      onShowContextMenu={props.onShowContextMenu}
      onHoverChange={props.onHoverChange}
      error={props.error}
      hasAgent={props.hasAgent}
      statusText={props.statusText}
    >
      <Show when={isCopying()}>
        <CopyingState
          statusText={props.statusText}
          inputValue={props.inputValue}
          hasAgent={props.hasAgent}
        />
      </Show>

      <Show when={!isCopying()}>
        <div class="contain-layout shrink-0 flex flex-col justify-center items-stretch min-w-[150px] max-w-[280px]">
          <SelectionLabelHeader
            tagName={props.tagName}
            componentName={props.componentName}
            elementsCount={props.elementsCount}
            inputValue={props.inputValue}
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
              jiraFlagged={props.jiraFlagged}
              jiraLabels={props.jiraLabels}
              jiraDueDate={props.jiraDueDate}
              jiraIssueType={props.jiraIssueType}
              jiraPriority={props.jiraPriority}
              jiraAssignee={props.jiraAssignee}
              jiraAssigneeAvatar={props.jiraAssigneeAvatar}
              onRefreshStatus={
                props.onRefreshJiraStatus
                  ? () => props.onRefreshJiraStatus?.()
                  : undefined
              }
              hasElementScreenshot={props.hasElementScreenshot}
              hasFullPageScreenshot={props.hasFullPageScreenshot}
              noTicketAction={
                props.onCreateTicket && !props.jiraTicketId ? (
                  <CreateTicketButton
                    onClick={() => props.onCreateTicket?.()}
                    class="self-stretch"
                  />
                ) : undefined
              }
            />
            {/* The thread itself lives in the sidebar; the card shows the
                latest comment and opens it there (ADR-0022, Label S6.2). */}
            <Show when={latestComment()}>
              {(comment) => (
                <div
                  data-react-grab-latest-comment
                  class="mt-2 flex w-full flex-col gap-0.5 rounded-md bg-muted px-2.5 py-2"
                >
                  <span class="text-caption text-muted-foreground">
                    {comment().author}
                    {comments().length > 1
                      ? ` · latest of ${comments().length} comments`
                      : ""}
                  </span>
                  <span class="line-clamp-2 text-body text-foreground">
                    {comment().body}
                  </span>
                </div>
              )}
            </Show>
            <Show when={props.onOpenThread}>
              <Button
                data-react-grab-ignore-events
                data-react-grab-open-thread
                type="button"
                variant="inverse"
                size="xs"
                class="mt-2 h-7 px-3 text-caption"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  props.onOpenThread?.();
                }}
              >
                Open thread
              </Button>
            </Show>
          </SelectionLabelContent>
          <DevInsightsSection
            tagName={props.tagName}
            componentName={props.componentName}
          />
        </div>
      </Show>

      <Show when={props.error}>
        <ErrorView error={props.error!} />
      </Show>
    </SelectionLabelRoot>
  );
};
