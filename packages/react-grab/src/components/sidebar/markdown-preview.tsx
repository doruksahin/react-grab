import { type Component, onCleanup, onMount } from "solid-js";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { cn } from "../../utils/cn.js";

interface MarkdownPreviewProps {
  markdown: string;
  class?: string;
}

/**
 * Markdown shown as formatted text: the same Tiptap + tiptap-markdown
 * renderer the comment editor uses, read-only.
 */
export const MarkdownPreview: Component<MarkdownPreviewProps> = (props) => {
  let element!: HTMLDivElement;
  let editor: Editor | undefined;

  onMount(() => {
    editor = new Editor({
      element,
      editable: false,
      extensions: [StarterKit, Markdown.configure({ html: false })],
      content: props.markdown,
    });
  });

  onCleanup(() => editor?.destroy());

  return (
    <div
      ref={element}
      data-react-grab-jira-description-preview
      class={cn("jira-editor-content text-body text-foreground", props.class)}
    />
  );
};
