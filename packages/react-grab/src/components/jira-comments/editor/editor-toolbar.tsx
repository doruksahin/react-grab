import type { Component } from "solid-js";
import type { Editor } from "@tiptap/core";
import { ToolbarButton, ToolbarSeparator, ToolbarDropdown } from "./toolbar.js";
import { EmojiPicker } from "./emoji-picker.js";
import { ColorPicker } from "./color-picker.js";

export const EditorToolbar: Component<{
  editor: Editor;
  onImageClick: () => void;
}> = (props) => {
  const active = (name: string, attrs?: Record<string, unknown>) =>
    props.editor.isActive(name, attrs);
  const chain = () => props.editor.chain().focus();

  return (
    <div class="flex flex-wrap gap-0.5 px-2 py-1.5 border-b border-border bg-muted/50" data-react-grab-ignore-events>
      <ToolbarButton title="Bold" active={active("bold")} onClick={() => chain().toggleBold().run()}>
        <b>B</b>
      </ToolbarButton>
      <ToolbarButton title="Italic" active={active("italic")} onClick={() => chain().toggleItalic().run()}>
        <i>I</i>
      </ToolbarButton>
      <ToolbarButton title="Underline" active={active("underline")} onClick={() => chain().toggleUnderline().run()}>
        <u>U</u>
      </ToolbarButton>
      <ToolbarButton title="Strike" active={active("strike")} onClick={() => chain().toggleStrike().run()}>
        <s>S</s>
      </ToolbarButton>
      <ToolbarButton title="Inline code" active={active("code")} onClick={() => chain().toggleCode().run()}>
        {"<>"}
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarDropdown title="Headings" label={<span>H</span>}>
        <button class="block w-full text-left px-2 py-1 text-[11px] rounded hover:bg-accent" onMouseDown={(e) => { e.preventDefault(); chain().setParagraph().run(); }}>Normal</button>
        <button class="block w-full text-left px-2 py-1 text-[11px] rounded hover:bg-accent font-bold" onMouseDown={(e) => { e.preventDefault(); chain().toggleHeading({ level: 1 }).run(); }}>Heading 1</button>
        <button class="block w-full text-left px-2 py-1 text-[11px] rounded hover:bg-accent font-bold" onMouseDown={(e) => { e.preventDefault(); chain().toggleHeading({ level: 2 }).run(); }}>Heading 2</button>
        <button class="block w-full text-left px-2 py-1 text-[11px] rounded hover:bg-accent font-bold" onMouseDown={(e) => { e.preventDefault(); chain().toggleHeading({ level: 3 }).run(); }}>Heading 3</button>
      </ToolbarDropdown>

      <ToolbarSeparator />

      <ToolbarButton title="Bullet list" active={active("bulletList")} onClick={() => chain().toggleBulletList().run()}>
        •—
      </ToolbarButton>
      <ToolbarButton title="Ordered list" active={active("orderedList")} onClick={() => chain().toggleOrderedList().run()}>
        1.
      </ToolbarButton>
      <ToolbarButton title="Blockquote" active={active("blockquote")} onClick={() => chain().toggleBlockquote().run()}>
        "
      </ToolbarButton>
      <ToolbarButton title="Code block" active={active("codeBlock")} onClick={() => chain().toggleCodeBlock().run()}>
        {"{ }"}
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarDropdown title="Text color" label={<span style={{ color: props.editor.getAttributes("textStyle")?.color ?? undefined }}>A</span>}>
        <ColorPicker
          activeColor={(props.editor.getAttributes("textStyle")?.color as string | undefined) ?? null}
          onSelect={(color) => {
            if (color) chain().setColor(color).run();
            else chain().unsetColor().run();
          }}
        />
      </ToolbarDropdown>

      <ToolbarButton title="Link" active={active("link")} onClick={() => {
        if (active("link")) { chain().unsetLink().run(); }
        else { const url = prompt("Enter URL:"); if (url) chain().setLink({ href: url }).run(); }
      }}>
        🔗
      </ToolbarButton>

      <ToolbarButton title="Image" onClick={props.onImageClick}>
        🖼
      </ToolbarButton>

      <ToolbarDropdown title="Emoji" label={<span>😀</span>}>
        <EmojiPicker onSelect={(emoji) => chain().insertContent(emoji).run()} />
      </ToolbarDropdown>

      <ToolbarSeparator />

      <ToolbarButton title="Undo" disabled={!props.editor.can().undo()} onClick={() => chain().undo().run()}>
        ↩
      </ToolbarButton>
      <ToolbarButton title="Redo" disabled={!props.editor.can().redo()} onClick={() => chain().redo().run()}>
        ↪
      </ToolbarButton>
    </div>
  );
};
