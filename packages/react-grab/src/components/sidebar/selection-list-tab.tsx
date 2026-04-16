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
import { DevInsights } from "./dev-insights.js";
import { useImageLightbox } from "../../features/image-lightbox/index.js";
import { SelectionCardBody } from "./selection-card-body.js";

interface SelectionListTabProps {
  commentItems: CommentItem[];
  groups: SelectionGroupWithJira[];
  filter?: FilterState;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  searchQuery?: string;
  flaggedOnly?: boolean;
  isDevMode?: boolean;
  syncServerUrl?: string;
  syncWorkspace?: string;
  onSubmitJiraComment?: SubmitGroupCommentFn;
  onSearchJiraUsers?: SearchJiraUsersFn;
  onRefreshJiraStatus?: RefreshGroupStatusFn;
}

export const SelectionListTab: Component<SelectionListTabProps> = (props) => {
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
    <div class="flex-1 overflow-y-auto">
      <Show when={filteredItems().length === 0}>
        <div class="py-8 text-center text-[12px] text-muted-foreground italic">
          No matching selections
        </div>
      </Show>
      <For each={filteredItems()}>
        {(item) => {
          const group = () => (item.groupId ? groupMap().get(item.groupId) : undefined);
          const isFlagged = () => group()?.jiraFlagged === true;
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
            <div
              class="border-b border-border px-4 py-3 cursor-pointer hover:bg-foreground/[0.02]"
              classList={{
                "border-l-[3px] border-l-red-400 pl-[13px]": isFlagged(),
                "bg-purple-400/[0.03] border-l-[3px] border-l-purple-400 pl-[13px]": isSelected() && !isFlagged(),
              }}
              style={{ position: "relative" }}
            >
              <div class="flex gap-3 items-start">
                {/* Multi-select checkbox */}
                <div
                  class="w-[14px] h-[14px] border rounded-[3px] mt-0.5 shrink-0 flex items-center justify-center cursor-pointer transition-all"
                  classList={{
                    "bg-purple-400 border-purple-400": isSelected(),
                    "bg-foreground/[0.03] border-foreground/20": !isSelected(),
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onToggleSelect?.(item.id);
                  }}
                >
                  <Show when={isSelected()}>
                    <span class="text-white text-[9px] font-bold">{"\u2713"}</span>
                  </Show>
                </div>

                {/* Card content */}
                <div class="flex-1 min-w-0" style={{ position: "relative" }}>
              <SelectionCardBody
                summary={summary()}
                timestamp={item.timestamp}
                itemId={item.id}
                hasElementScreenshot={Boolean(item.screenshotElement)}
                hasFullPageScreenshot={Boolean(item.screenshotFullPage)}
                syncServerUrl={props.syncServerUrl}
                syncWorkspace={props.syncWorkspace}
                jiraTicketId={group()?.jiraTicketId}
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
                onScreenshotClick={(src, label) => lightbox.open(src, label)}
              />

              {/* Dev insights (technical info) — stays outside SelectionCardBody, sidebar-only */}
              <Show when={props.isDevMode}>
                <DevInsights
                  tagName={item.tagName}
                  componentName={item.componentName}
                  content={item.content}
                />
              </Show>
                </div>{/* end card content */}
              </div>{/* end flex row */}
            </div>
          );
        }}
      </For>
    </div>
  );
};
