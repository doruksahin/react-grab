import { Show } from "solid-js";
import type { Component } from "solid-js";
import { getTagDisplay } from "../../../utils/get-tag-display.js";
import { FlagIndicator } from "../../flag-indicator.js";
import type { SelectionLabelCardHeaderProps } from "../types.js";

/**
 * A saved label's card header (Label board S6.2): the comment on its own
 * line, then the element and the group as a muted line.
 */
export const SelectionLabelCardHeader: Component<
  SelectionLabelCardHeaderProps
> = (props) => {
  const tagDisplay = () =>
    getTagDisplay({
      tagName: props.tagName,
      componentName: props.componentName,
      elementsCount: props.elementsCount,
    });

  const element = () =>
    [tagDisplay().componentName, tagDisplay().tagName]
      .filter(Boolean)
      .join(" · ");

  return (
    <div
      data-react-grab-selection-header
      class="flex w-full flex-col gap-1 border-b border-border bg-muted px-2.5 pt-2 pb-1.5"
    >
      <div class="flex min-w-0 items-start gap-1.5">
        <Show when={props.jiraFlagged}>
          <FlagIndicator
            flaggedAt={props.jiraFlaggedAt}
            flaggedBy={props.jiraFlaggedBy}
            flaggedByAvatar={props.jiraFlaggedByAvatar}
          />
        </Show>
        <span class="line-clamp-2 min-w-0 flex-1 text-body leading-5 font-medium text-popover-foreground">
          {props.title || element()}
        </span>
      </div>
      <div class="flex min-w-0 items-center gap-1 text-caption text-muted-foreground">
        <span class="min-w-0 truncate">{element()}</span>
        <span class="flex-1" />
        <Show when={props.trailing}>
          <span class="flex min-w-0 shrink items-center overflow-hidden whitespace-nowrap">
            {props.trailing}
          </span>
        </Show>
      </div>
    </div>
  );
};
