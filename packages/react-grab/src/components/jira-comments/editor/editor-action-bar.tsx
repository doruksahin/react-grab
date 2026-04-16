import { type Component, Show } from "solid-js";

const FormatIcon: Component = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
  <div class="flex items-center gap-2 px-2 py-1.5 border-t border-border" data-react-grab-ignore-events>
    <button
      type="button"
      data-react-grab-editor-toolbar-toggle
      title="Toggle formatting"
      classList={{ "bg-accent text-foreground": props.toolbarVisible }}
      class="flex items-center justify-center p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
      onMouseDown={(e) => { e.preventDefault(); props.onToggleToolbar(); }}
    >
      <FormatIcon />
    </button>
    <button
      type="button"
      data-react-grab-comment-submit
      class="px-3 py-1 rounded text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      onMouseDown={(e) => { e.preventDefault(); props.onSubmit(); }}
    >
      Save
    </button>
    <Show when={props.onCancel}>
      <button
        type="button"
        data-react-grab-comment-cancel
        class="px-3 py-1 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        onMouseDown={(e) => { e.preventDefault(); props.onCancel?.(); }}
      >
        Cancel
      </button>
    </Show>
    <span data-react-grab-comment-hint class="ml-auto text-[10px] text-muted-foreground">
      Tip: Type <kbd class="px-1 py-0.5 bg-muted rounded text-[9px]">@</kbd> to mention
    </span>
  </div>
);
