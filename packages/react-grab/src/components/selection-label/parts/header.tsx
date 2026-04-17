import { Show } from "solid-js";
import type { Component } from "solid-js";
import { getTagDisplay } from "../../../utils/get-tag-display.js";
import { TagBadge } from "../tag-badge.js";
import { FlagIndicator } from "../../flag-indicator.js";
import { IconChevron } from "../../icons/icon-chevron.js";
import type { SelectionLabelHeaderProps } from "../types.js";

export const SelectionLabelHeader: Component<SelectionLabelHeaderProps> = (
  props,
) => {
  const tagDisplayResult = () =>
    getTagDisplay({
      tagName: props.tagName,
      componentName: props.componentName,
      elementsCount: props.elementsCount,
    });

  const handleTagClick = (event: MouseEvent) => {
    event.stopImmediatePropagation();
    if (props.filePath && props.onOpen) {
      props.onOpen();
    }
  };

  return (
    <div
      data-react-grab-selection-header
      class="contain-layout shrink-0 flex items-baseline gap-1 pt-1.5 pb-1 h-fit px-2 w-full bg-popover-foreground/[0.04]"
      classList={{
        "py-1.5": !props.compactPadding,
        "pt-1.5 pb-1": Boolean(props.compactPadding),
      }}
    >
      <Show when={props.jiraFlagged}>
        <FlagIndicator
          flaggedAt={props.jiraFlaggedAt}
          flaggedBy={props.jiraFlaggedBy}
          flaggedByAvatar={props.jiraFlaggedByAvatar}
        />
      </Show>
      <Show
        when={props.inputValue}
        fallback={
          <TagBadge
            tagName={tagDisplayResult().tagName}
            componentName={tagDisplayResult().componentName}
            isClickable={Boolean(props.filePath && props.onOpen)}
            onClick={handleTagClick}
            shrink={!props.trailing}
            forceShowIcon={
              props.trailing
                ? true
                : Boolean(props.isContextMenuOpen)
            }
          />
        }
      >
        <span class="text-[13px] leading-4 h-fit font-medium overflow-hidden text-ellipsis whitespace-nowrap min-w-0 text-popover-foreground">
          {props.inputValue}
        </span>
      </Show>
      <Show when={props.onCollapse}>
        <button
          data-react-grab-ignore-events
          data-react-grab-collapse-label
          title="Collapse"
          class="contain-layout shrink-0 flex items-center justify-center size-5 rounded-md text-popover-foreground opacity-60 hover:opacity-100 hover:bg-accent cursor-pointer transition-all ml-1"
          onClick={(event) => {
            event.stopImmediatePropagation();
            props.onCollapse?.();
          }}
          onPointerDown={(event) => event.stopImmediatePropagation()}
        >
          <IconChevron size={12} />
        </button>
      </Show>
      <Show when={props.trailing}>
        <span class="flex-1" />
        {props.trailing}
      </Show>
    </div>
  );
};
