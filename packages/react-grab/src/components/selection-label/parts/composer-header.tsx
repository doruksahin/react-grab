import { Show } from "solid-js";
import type { Component } from "solid-js";
import { getTagDisplay } from "../../../utils/get-tag-display.js";
import { getFileName } from "../../../utils/get-file-name.js";
import { FlagIndicator } from "../../flag-indicator.js";
import { IconOpen } from "../../icons/icon-open.js";
import { IconX } from "../../icons/icon-x.js";
import { IconButton } from "../../ui/icon-button.js";
import type { SelectionLabelComposerHeaderProps } from "../types.js";

/** One line naming the element: component, then tag and file, then close. */
export const SelectionLabelComposerHeader: Component<
  SelectionLabelComposerHeaderProps
> = (props) => {
  const tagDisplay = () =>
    getTagDisplay({
      tagName: props.tagName,
      componentName: props.componentName,
      elementsCount: props.elementsCount,
    });

  const title = () => tagDisplay().componentName ?? tagDisplay().tagName;

  const details = () =>
    [
      tagDisplay().componentName ? tagDisplay().tagName : undefined,
      props.filePath ? getFileName(props.filePath) : undefined,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div
      data-react-grab-selection-header
      class="flex min-w-0 items-center gap-2 px-3.5 pt-3"
    >
      <Show when={props.jiraFlagged}>
        <FlagIndicator
          flaggedAt={props.jiraFlaggedAt}
          flaggedBy={props.jiraFlaggedBy}
          flaggedByAvatar={props.jiraFlaggedByAvatar}
        />
      </Show>
      <span class="shrink-0 truncate text-body font-semibold text-popover-foreground">
        {title()}
      </span>
      <span class="min-w-0 flex-1 truncate text-caption text-muted-foreground">
        {details()}
      </span>
      <Show when={props.filePath && props.onOpen}>
        <IconButton
          data-react-grab-ignore-events
          label="Open in editor"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopImmediatePropagation();
            props.onOpen?.();
          }}
        >
          <IconOpen size={12} />
        </IconButton>
      </Show>
      <Show when={props.onClose}>
        <IconButton
          data-react-grab-ignore-events
          label="Discard comment"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopImmediatePropagation();
            props.onClose?.();
          }}
        >
          <IconX size={14} />
        </IconButton>
      </Show>
    </div>
  );
};
