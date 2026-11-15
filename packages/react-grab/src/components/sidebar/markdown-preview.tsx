import {
  type Component,
  type ComponentProps,
  createEffect,
  on,
  onCleanup,
  onMount,
  splitProps,
} from "solid-js";
import { Editor } from "@tiptap/core";
import { markdownBaseExtensions } from "../../utils/markdown-extensions.js";
import { cn } from "../../utils/cn.js";

interface MarkdownPreviewProps extends Omit<ComponentProps<"div">, "children"> {
  markdown: string;
}

/**
 * Markdown shown as formatted text: the same Tiptap + tiptap-markdown
 * renderer the comment editor uses, read-only.
 */
export const MarkdownPreview: Component<MarkdownPreviewProps> = (props) => {
  const [local, rest] = splitProps(props, ["markdown", "class"]);
  let element!: HTMLDivElement;
  let editor: Editor | undefined;

  onMount(() => {
    editor = new Editor({
      element,
      editable: false,
      extensions: markdownBaseExtensions,
      content: local.markdown,
    });
  });

  createEffect(
    on(
      () => local.markdown,
      (markdown) => editor?.commands.setContent(markdown),
      { defer: true },
    ),
  );

  onCleanup(() => editor?.destroy());

  return (
    <div
      ref={element}
      class={cn("rich-text-content text-body text-foreground", local.class)}
      {...rest}
    />
  );
};
