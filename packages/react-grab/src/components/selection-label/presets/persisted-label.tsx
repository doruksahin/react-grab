import { Show } from "solid-js";
import type { Component } from "solid-js";
import type {
  OverlayBounds,
  SelectionLabelStatus,
  JiraDisplayFields,
} from "../../../types.js";
import type { SelectionGroupWithJira } from "../../../features/sidebar/jira-types.js";
import type {
  SubmitCommentFn,
  SearchJiraUsersFn,
} from "../../../features/jira-comments/types.js";
import { SelectionLabelRoot } from "../index.js";
import { SelectionLabelHeader } from "../parts/header.js";
import { SelectionLabelContent } from "../parts/content.js";
import { DevInsightsSection } from "../parts/dev-insights-section.js";
import { CopyingState } from "../parts/copying-state.js";
import { ErrorView } from "../error-view.js";
import { CreateTicketButton } from "../create-ticket-button.js";
import { SelectionCardBody } from "../../sidebar/selection-card-body.js";
import { ActiveGroupPicker } from "../../../features/selection-groups/components/active-group-picker.js";

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

  onSubmitJiraComment?: SubmitCommentFn;
  onSearchJiraUsers?: SearchJiraUsersFn;
  onRefreshJiraStatus?: () => void;
  commentEditorToolbarVisible?: boolean;

  isCollapsing?: boolean;
  onCollapse?: () => void;
  extraTopOffset?: number;
  onPlacementChange?: (placement: "above" | "below") => void;
}

export const PersistedLabel: Component<PersistedLabelProps> = (props) => {
  const isCopying = () => props.status === "copying";

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
              commentEditorToolbarVisible={props.commentEditorToolbarVisible}
              hasElementScreenshot={props.hasElementScreenshot}
              hasFullPageScreenshot={props.hasFullPageScreenshot}
              noTicketAction={
                props.onCreateTicket && !props.jiraTicketId
                  ? <CreateTicketButton onClick={() => props.onCreateTicket?.()} class="w-full" />
                  : undefined
              }
            />
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
