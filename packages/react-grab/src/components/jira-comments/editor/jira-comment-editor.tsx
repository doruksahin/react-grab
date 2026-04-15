import { type Component, createSignal, onCleanup, onMount, Show } from "solid-js";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";

const MentionWithMarkdown = Mention.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: { write(s: string): void }, node: { attrs: Record<string, string> }) {
          state.write(`@${node.attrs.label ?? ""}`);
        },
        parse: {},
      },
    };
  },
});
import { extractMentions } from "../../../features/jira-comments/extract-mentions.js";
import { setupImageHandlers } from "../../../features/jira-comments/use-editor-images.js";
import type { JiraCommentEditorProps } from "../../../features/jira-comments/types.js";
import { createMentionSuggestion } from "./mention-picker.js";
import { EditorToolbar } from "./editor-toolbar.js";

export const JiraCommentEditor: Component<JiraCommentEditorProps> = (props) => {
  let editorEl!: HTMLDivElement;
  let fileInput!: HTMLInputElement;
  const [editor, setEditor] = createSignal<Editor>();

  onMount(() => {
    const ed = new Editor({
      element: editorEl,
      extensions: [
        StarterKit,
        Markdown.configure({ html: false, transformPastedText: true }),
        Link.configure({ openOnClick: false }),
        Underline,
        TextStyle,
        Color,
        Image.configure({
          allowBase64: true,
          HTMLAttributes: { class: "jira-editor-image" },
        }),
        MentionWithMarkdown.configure({
          HTMLAttributes: { class: "mention" },
          suggestion: createMentionSuggestion(props.onSearchUsers),
          renderText: ({ node }) => `@${node.attrs.label ?? ""}`,
        }),
        Placeholder.configure({ placeholder: props.placeholder ?? "Add a comment..." }),
      ],
      content: props.initialContent ?? "",
    });
    setEditor(ed);

    const images = setupImageHandlers(editorEl, () => editor());
    fileInput.addEventListener("change", images.handleFileInput as EventListener);
    onCleanup(() => {
      images.cleanup();
      fileInput?.removeEventListener("change", images.handleFileInput as EventListener);
      ed.destroy();
    });
  });

  function handleSubmit() {
    const ed = editor();
    if (!ed) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const md: string = (ed.storage as any).markdown.getMarkdown();
    if (!md.trim()) return;
    const json = ed.getJSON();
    const mentions = extractMentions(json as Parameters<typeof extractMentions>[0]);
    props.onSubmit(md, mentions);
    ed.commands.clearContent();
  }

  return (
    <div
      data-react-grab-comment-composer
      class="flex flex-col rounded border border-border bg-muted/40 overflow-hidden"
      style={{ "pointer-events": "auto" }}
    >
      {/* Toolbar */}
      <Show when={editor()}>
        {(ed) => <EditorToolbar editor={ed()} onImageClick={() => fileInput?.click()} />}
      </Show>

      {/* Hidden file input */}
      <input ref={fileInput} type="file" accept="image/*" style={{ display: "none" }} />

      {/* Editor content area */}
      <div
        ref={editorEl}
        data-react-grab-comment-editor
        data-react-grab-ignore-events
        class="jira-editor-content px-3 py-2 min-h-[100px] text-[12px] text-foreground outline-none"
        style={{ "pointer-events": "auto" }}
      />

      {/* Action bar */}
      <div class="flex items-center gap-2 px-2 py-1.5 border-t border-border" data-react-grab-ignore-events>
        <button
          type="button"
          data-react-grab-comment-submit
          class="px-3 py-1 rounded text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          onMouseDown={(e) => { e.preventDefault(); handleSubmit(); }}
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
        <span class="ml-auto text-[10px] text-muted-foreground">
          Tip: Type <kbd class="px-1 py-0.5 bg-muted rounded text-[9px]">@</kbd> to mention
        </span>
      </div>
    </div>
  );
};
