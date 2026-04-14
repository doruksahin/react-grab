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
import { extractMentions } from "../../../features/jira-comments/extract-mentions.js";
import type { JiraCommentEditorProps } from "../../../features/jira-comments/types.js";
import { ToolbarButton, ToolbarSeparator, ToolbarDropdown } from "./toolbar.js";
import { createMentionSuggestion } from "./mention-picker.js";
import { EmojiPicker } from "./emoji-picker.js";
import { ColorPicker } from "./color-picker.js";

export const JiraCommentEditor: Component<JiraCommentEditorProps> = (props) => {
  let editorEl!: HTMLDivElement;
  let fileInput!: HTMLInputElement;
  let editor: Editor | undefined;
  const [, tick] = createSignal(0);

  onMount(() => {
    editor = new Editor({
      element: editorEl,
      extensions: [
        StarterKit,
        Markdown.configure({ html: false, transformPastedText: true }),
        Link.configure({ openOnClick: false }),
        Underline,
        TextStyle,
        Color,
        Image,
        Mention.configure({
          HTMLAttributes: { class: "mention" },
          suggestion: createMentionSuggestion(props.onSearchUsers),
          renderText: ({ node }) => `@${node.attrs.label ?? ""}`,
        }),
        Placeholder.configure({ placeholder: "Add a comment..." }),
      ],
      content: "",
      onTransaction: () => tick((n) => n + 1),
    });

    editorEl.addEventListener("paste", handlePaste);
    editorEl.addEventListener("dragover", (e) => e.preventDefault());
    editorEl.addEventListener("drop", handleDrop);
  });

  onCleanup(() => {
    editorEl?.removeEventListener("paste", handlePaste);
    editorEl?.removeEventListener("drop", handleDrop);
    editor?.destroy();
  });

  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) insertImageFile(file);
        return;
      }
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (const file of files) {
      if (file.type.startsWith("image/")) insertImageFile(file);
    }
  }

  function insertImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        editor?.chain().focus().setImage({ src: reader.result }).run();
      }
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit() {
    if (!editor) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const md: string = (editor.storage as any).markdown.getMarkdown();
    if (!md.trim()) return;
    const json = editor.getJSON();
    const mentions = extractMentions(json as Parameters<typeof extractMentions>[0]);
    props.onSubmit(md, mentions);
    editor.commands.clearContent();
  }

  const active = (name: string, attrs?: Record<string, unknown>) =>
    editor?.isActive(name, attrs) ?? false;

  return (
    <div
      data-react-grab-comment-composer
      class="flex flex-col rounded border border-border bg-muted/40 overflow-hidden"
      style={{ "pointer-events": "auto" }}
    >
      <Show when={props.replyTo}>
        {(reply) => (
          <div
            data-react-grab-reply-context
            data-react-grab-ignore-events
            class="flex items-center gap-2 px-2 py-1 bg-accent/30 border-b border-border text-[10px] text-muted-foreground"
          >
            <span>Replying to <strong class="text-foreground">{reply().author}</strong></span>
            <button
              type="button"
              class="ml-auto text-muted-foreground hover:text-foreground"
              onMouseDown={(e) => { e.preventDefault(); props.onCancelReply?.(); }}
            >
              ✕
            </button>
          </div>
        )}
      </Show>

      <div class="flex flex-wrap gap-0.5 px-2 py-1.5 border-b border-border bg-muted/50" data-react-grab-ignore-events>
        <ToolbarButton title="Bold" active={active("bold")} onClick={() => editor!.chain().focus().toggleBold().run()}>
          <b>B</b>
        </ToolbarButton>
        <ToolbarButton title="Italic" active={active("italic")} onClick={() => editor!.chain().focus().toggleItalic().run()}>
          <i>I</i>
        </ToolbarButton>
        <ToolbarButton title="Underline" active={active("underline")} onClick={() => editor!.chain().focus().toggleUnderline().run()}>
          <u>U</u>
        </ToolbarButton>
        <ToolbarButton title="Strike" active={active("strike")} onClick={() => editor!.chain().focus().toggleStrike().run()}>
          <s>S</s>
        </ToolbarButton>
        <ToolbarButton title="Inline code" active={active("code")} onClick={() => editor!.chain().focus().toggleCode().run()}>
          {"<>"}
        </ToolbarButton>

        <ToolbarSeparator />

        <ToolbarDropdown title="Headings" label={<span>H</span>}>
          <button class="block w-full text-left px-2 py-1 text-[11px] rounded hover:bg-accent" onMouseDown={(e) => { e.preventDefault(); editor!.chain().focus().setParagraph().run(); }}>Normal</button>
          <button class="block w-full text-left px-2 py-1 text-[11px] rounded hover:bg-accent font-bold" onMouseDown={(e) => { e.preventDefault(); editor!.chain().focus().toggleHeading({ level: 1 }).run(); }}>Heading 1</button>
          <button class="block w-full text-left px-2 py-1 text-[11px] rounded hover:bg-accent font-bold" onMouseDown={(e) => { e.preventDefault(); editor!.chain().focus().toggleHeading({ level: 2 }).run(); }}>Heading 2</button>
          <button class="block w-full text-left px-2 py-1 text-[11px] rounded hover:bg-accent font-bold" onMouseDown={(e) => { e.preventDefault(); editor!.chain().focus().toggleHeading({ level: 3 }).run(); }}>Heading 3</button>
        </ToolbarDropdown>

        <ToolbarSeparator />

        <ToolbarButton title="Bullet list" active={active("bulletList")} onClick={() => editor!.chain().focus().toggleBulletList().run()}>
          •—
        </ToolbarButton>
        <ToolbarButton title="Ordered list" active={active("orderedList")} onClick={() => editor!.chain().focus().toggleOrderedList().run()}>
          1.
        </ToolbarButton>
        <ToolbarButton title="Blockquote" active={active("blockquote")} onClick={() => editor!.chain().focus().toggleBlockquote().run()}>
          "
        </ToolbarButton>
        <ToolbarButton title="Code block" active={active("codeBlock")} onClick={() => editor!.chain().focus().toggleCodeBlock().run()}>
          {"{ }"}
        </ToolbarButton>

        <ToolbarSeparator />

        <ToolbarDropdown title="Text color" label={<span style={{ color: editor?.getAttributes("textStyle")?.color ?? undefined }}>A</span>}>
          <ColorPicker
            activeColor={(editor?.getAttributes("textStyle")?.color as string | undefined) ?? null}
            onSelect={(color) => {
              if (color) editor!.chain().focus().setColor(color).run();
              else editor!.chain().focus().unsetColor().run();
            }}
          />
        </ToolbarDropdown>

        <ToolbarButton title="Link" active={active("link")} onClick={() => {
          if (active("link")) { editor!.chain().focus().unsetLink().run(); }
          else { const url = prompt("Enter URL:"); if (url) editor!.chain().focus().setLink({ href: url }).run(); }
        }}>
          🔗
        </ToolbarButton>

        <ToolbarButton title="Image" onClick={() => fileInput?.click()}>
          🖼
        </ToolbarButton>

        <ToolbarDropdown title="Emoji" label={<span>😀</span>}>
          <EmojiPicker onSelect={(emoji) => editor!.chain().focus().insertContent(emoji).run()} />
        </ToolbarDropdown>

        <ToolbarSeparator />

        <ToolbarButton title="Undo" disabled={!editor?.can().undo()} onClick={() => editor!.chain().focus().undo().run()}>
          ↩
        </ToolbarButton>
        <ToolbarButton title="Redo" disabled={!editor?.can().redo()} onClick={() => editor!.chain().focus().redo().run()}>
          ↪
        </ToolbarButton>
      </div>

      <input ref={fileInput} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
        const file = e.currentTarget.files?.[0];
        if (file) insertImageFile(file);
        e.currentTarget.value = "";
      }} />

      <div
        ref={editorEl}
        data-react-grab-comment-editor
        class="jira-editor-content px-3 py-2 min-h-[100px] text-[12px] text-foreground outline-none"
        style={{ "pointer-events": "auto" }}
      />

      <div class="flex items-center gap-2 px-2 py-1.5 border-t border-border" data-react-grab-ignore-events>
        <button
          type="button"
          data-react-grab-comment-submit
          class="px-3 py-1 rounded text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          onMouseDown={(e) => { e.preventDefault(); handleSubmit(); }}
        >
          {props.replyTo ? "Reply" : "Save"}
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
