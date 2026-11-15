import { type Component, Show } from "solid-js";
import { Button } from "../../ui/button.js";

const FormatIcon: Component = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="9" y1="20" x2="15" y2="20" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </svg>
);

export const EditorActionBar: Component<{
  toolbarVisible: boolean;
  onToggleToolbar: () => void;
  onSubmit: () => void;
  onCancel?: () => void;
}> = (props) => (
  <div
    class="flex items-center gap-2 px-2 py-1.5 border-t border-border"
    data-react-grab-ignore-events
  >
    <Button
      type="button"
      data-react-grab-editor-toolbar-toggle
      variant="subtle"
      size="icon-xs"
      title="Toggle formatting"
      aria-pressed={props.toolbarVisible}
      onMouseDown={(e) => {
        e.preventDefault();
        props.onToggleToolbar();
      }}
    >
      <FormatIcon />
    </Button>
    <Button
      type="button"
      data-react-grab-comment-submit
      size="xs"
      onMouseDown={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
    >
      Save
    </Button>
    <Show when={props.onCancel}>
      <Button
        type="button"
        data-react-grab-comment-cancel
        variant="subtle"
        size="xs"
        onMouseDown={(e) => {
          e.preventDefault();
          props.onCancel?.();
        }}
      >
        Cancel
      </Button>
    </Show>
    <span
      data-react-grab-comment-hint
      class="ml-auto text-meta text-muted-foreground"
    >
      Tip: Type <kbd class="px-1 py-0.5 bg-muted rounded text-meta">@</kbd> to
      mention
    </span>
  </div>
);
