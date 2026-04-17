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
import { TEXTAREA_MAX_HEIGHT_PX } from "../../../constants.js";
import { SelectionLabelRoot } from "../index.js";
import { SelectionLabelHeader } from "../parts/header.js";
import { SelectionLabelContent } from "../parts/content.js";
import { ErrorView } from "../error-view.js";
import { BottomSection } from "../bottom-section.js";
import { CreateTicketButton } from "../create-ticket-button.js";
import { SelectionCardBody } from "../../sidebar/selection-card-body.js";
import { ActiveGroupPicker } from "../../../features/selection-groups/components/active-group-picker.js";
import { IconLoader } from "../../icons/icon-loader.js";

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
        <div
          class="contain-layout shrink-0 flex flex-col justify-center items-start w-fit h-fit max-w-[280px]"
          classList={{
            "min-w-[150px]": Boolean(props.hasAgent && props.inputValue),
          }}
        >
          <div class="contain-layout shrink-0 flex items-center gap-1 py-1.5 px-2 w-full h-fit">
            <IconLoader size={13} class="text-muted-foreground shrink-0" />
            <span class="shimmer-text text-[13px] leading-4 font-medium h-fit tabular-nums overflow-hidden text-ellipsis whitespace-nowrap">
              {props.statusText ?? "Grabbing\u2026"}
            </span>
          </div>
          <Show when={props.hasAgent && props.inputValue}>
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
              </div>
            </BottomSection>
          </Show>
        </div>
      </Show>

      <Show when={!isCopying()}>
        <div class="contain-layout shrink-0 flex flex-col justify-center items-start min-w-[150px] max-w-[280px] gap-1">
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
        </div>
      </Show>

      <Show when={props.error}>
        <ErrorView error={props.error!} />
      </Show>
    </SelectionLabelRoot>
  );
};
