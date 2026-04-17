import { type Component, createMemo, For, Show } from "solid-js";
import type { CommentItem } from "../../types.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import {
  applyFilters,
  type FilterState,
  isFilterActive,
} from "../../features/sidebar/filter-state.js";
import { bindGroupCommentCallbacks } from "../../features/jira-comments/bind-group-callbacks.js";
import type {
  RefreshGroupStatusFn,
  SearchJiraUsersFn,
  SubmitGroupCommentFn,
} from "../../features/jira-comments/types.js";
import { useImageLightbox } from "../../features/image-lightbox/index.js";
import { isSelectionLocked } from "../../features/selection-groups/business/ticket-lock.js";
import { SelectionCardBody } from "./selection-card-body.js";
import { SelectionCheckbox } from "../ui/selection-checkbox.js";
import { SelectionCard } from "../ui/selection-card.js";
import { CreateTicketButton } from "../ui/create-ticket-button.js";
import { DevInsights } from "../ui/dev-insights/index.js";
import { useDevMode } from "../../features/dev-mode/index.js";
import { ActiveGroupPicker } from "../../features/selection-groups/components/active-group-picker.js";

interface SelectionListTabProps {
  commentItems: CommentItem[];
  groups: SelectionGroupWithJira[];
  filter?: FilterState;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  searchQuery?: string;
  flaggedOnly?: boolean;
  syncServerUrl?: string;
  syncWorkspace?: string;
  onSubmitJiraComment?: SubmitGroupCommentFn;
  onSearchJiraUsers?: SearchJiraUsersFn;
  onRefreshJiraStatus?: RefreshGroupStatusFn;
  commentEditorToolbarVisible?: boolean;
  onCreateTicket?: (item: CommentItem) => void;
  onMoveItem?: (itemId: string, groupId: string | null) => void;
  onAddGroup?: (name: string) => void;
}

export const SelectionListTab: Component<SelectionListTabProps> = (props) => {
  const isDevMode = useDevMode();
  const lightbox = useImageLightbox();

  const groupMap = createMemo(
    () => new Map(props.groups.map((g) => [g.id, g])),
  );

  const filteredItems = () => {
    let items = props.commentItems;

    const query = props.searchQuery?.toLowerCase();
    if (query) {
      items = items.filter((item) => {
        const text = (item.commentText ?? item.componentName ?? item.tagName).toLowerCase();
        return text.includes(query);
      });
    }

    if (props.flaggedOnly) {
      items = items.filter((item) => {
        if (!item.groupId) return false;
        const group = groupMap().get(item.groupId);
        return group?.jiraFlagged === true;
      });
    }

    const filter = props.filter;
    if (filter && isFilterActive(filter)) {
      const allowedGroupIds = new Set(
        applyFilters(props.groups, filter).map((g) => g.id),
      );
      items = items.filter(
        (item) => item.groupId != null && allowedGroupIds.has(item.groupId),
      );
    }

    return items;
  };

  return (
    <div class="flex-1 overflow-y-auto p-2 flex flex-col gap-2.5">
      <Show when={filteredItems().length === 0}>
        <div class="py-8 text-center text-[12px] text-muted-foreground italic">
          No matching selections
        </div>
      </Show>
      <For each={filteredItems()}>
        {(item) => {
          const group = () => (item.groupId ? groupMap().get(item.groupId) : undefined);
          const isFlagged = () => group()?.jiraFlagged === true;
          const checkable = () => !isSelectionLocked({ groupId: item.groupId }, props.groups);
          const isSelected = () => props.selectedIds?.has(item.id) === true;
          const summary = () =>
            item.commentText || item.componentName || item.tagName;

          const boundCommentSubmit = () => {
            const g = group();
            const submit = props.onSubmitJiraComment;
            if (!g || !submit) return undefined;
            return bindGroupCommentCallbacks(g.id, {
              onSubmitComment: submit,
              onSearchUsers: props.onSearchJiraUsers,
              onRefreshStatus: props.onRefreshJiraStatus,
            }).onSubmitComment;
          };

          const refreshStatus = () => {
            const g = group();
            const refresh = props.onRefreshJiraStatus;
            if (!g || !refresh) return undefined;
            return () => refresh(g.id);
          };

          return (
            <SelectionCard flagged={isFlagged()} selected={isSelected()}>
              <SelectionCardBody
                leading={
                  props.onToggleSelect && checkable()
                    ? <SelectionCheckbox checked={isSelected()} onToggle={() => props.onToggleSelect?.(item.id)} />
                    : undefined
                }
                subheader={
                  <ActiveGroupPicker
                    groups={props.groups}
                    activeGroupId={item.groupId}
                    onActiveGroupChange={(groupId) => props.onMoveItem?.(item.id, groupId)}
                    onAddGroup={props.onAddGroup}
                  >
                    <ActiveGroupPicker.Trigger />
                    <ActiveGroupPicker.Content />
                  </ActiveGroupPicker>
                }
                noTicketAction={
                  !group()?.jiraTicketId && props.onCreateTicket
                    ? <CreateTicketButton onClick={() => props.onCreateTicket!(item)} class="w-full" />
                    : undefined
                }
                summary={summary()}
                timestamp={item.timestamp}
                itemId={item.id}
                hasElementScreenshot={Boolean(item.screenshotElement)}
                hasFullPageScreenshot={Boolean(item.screenshotFullPage)}
                syncServerUrl={props.syncServerUrl}
                syncWorkspace={props.syncWorkspace}
                jiraTicketId={group()?.jiraTicketId}
                jiraUrl={group()?.jiraUrl}
                jiraStatus={group()?.jiraStatus}
                jiraStatusCategory={group()?.jiraStatusCategory}
                jiraLabels={group()?.jiraLabels}
                jiraDueDate={group()?.jiraDueDate}
                jiraIssueType={group()?.jiraIssueType}
                jiraPriority={group()?.jiraPriority}
                jiraAssignee={group()?.jiraAssignee}
                jiraAssigneeAvatar={group()?.jiraAssigneeAvatar}
                jiraComments={group()?.jiraComments}
                onSubmitComment={boundCommentSubmit()}
                onSearchUsers={props.onSearchJiraUsers}
                onRefreshStatus={refreshStatus()}
                commentEditorToolbarVisible={props.commentEditorToolbarVisible}
                onScreenshotClick={(src, label) => lightbox.open(src, label)}
              />
              <Show when={isDevMode()}>
                <DevInsights>
                  <DevInsights.Field label="tag" value={item.tagName} color="green" />
                  <DevInsights.Field label="node" value={item.componentName ?? item.elementName} color="purple" />
                  <DevInsights.Attributes content={item.content} />
                  <Show when={item.elementSelectors?.[0]}>
                    <DevInsights.Section label="selector">
                      <span class="text-[9px] font-mono text-[#cbd5e1] break-all">{item.elementSelectors?.[0]}</span>
                    </DevInsights.Section>
                  </Show>
                  <DevInsights.Section label="html">
                    <pre class="text-[9px] font-mono text-[#cbd5e1] whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto leading-relaxed">{item.content}</pre>
                  </DevInsights.Section>
                </DevInsights>
              </Show>
            </SelectionCard>
          );
        }}
      </For>
    </div>
  );
};
