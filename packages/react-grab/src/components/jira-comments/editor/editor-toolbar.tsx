import { type Component, For } from "solid-js";
import type { Editor } from "@tiptap/core";
import { ToolbarButton, ToolbarSeparator, ToolbarDropdown } from "./toolbar.js";
import { EmojiPicker } from "./emoji-picker.js";
import { ColorPicker } from "./color-picker.js";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../../ui/menu.js";

interface HeadingOption {
  label: string;
  level: 1 | 2 | 3 | null;
}

const HEADING_OPTIONS: ReadonlyArray<HeadingOption> = [
  { label: "Normal", level: null },
  { label: "Heading 1", level: 1 },
  { label: "Heading 2", level: 2 },
  { label: "Heading 3", level: 3 },
];

export const EditorToolbar: Component<{
  editor: Editor;
  onImageClick: () => void;
}> = (props) => {
  const active = (name: string, attrs?: Record<string, unknown>) =>
    props.editor.isActive(name, attrs);
  const chain = () => props.editor.chain().focus();

  return (
    <div
      data-react-grab-editor-toolbar
      class="flex flex-wrap gap-0.5 px-2 py-1.5 border-b border-border bg-muted/50"
      data-react-grab-ignore-events
    >
      <ToolbarButton
        dataAction="bold"
        title="Bold"
        active={active("bold")}
        onClick={() => chain().toggleBold().run()}
      >
        <b>B</b>
      </ToolbarButton>
      <ToolbarButton
        dataAction="italic"
        title="Italic"
        active={active("italic")}
        onClick={() => chain().toggleItalic().run()}
      >
        <i>I</i>
      </ToolbarButton>
      <ToolbarButton
        dataAction="underline"
        title="Underline"
        active={active("underline")}
        onClick={() => chain().toggleUnderline().run()}
      >
        <u>U</u>
      </ToolbarButton>
      <ToolbarButton
        dataAction="strike"
        title="Strike"
        active={active("strike")}
        onClick={() => chain().toggleStrike().run()}
      >
        <s>S</s>
      </ToolbarButton>
      <ToolbarButton
        dataAction="code"
        title="Inline code"
        active={active("code")}
        onClick={() => chain().toggleCode().run()}
      >
        {"<>"}
      </ToolbarButton>

      <ToolbarSeparator />

      <Menu>
        <MenuTrigger
          data-react-grab-editor-dropdown="headings"
          title="Headings"
          variant="toolbar"
        >
          <span>H</span>
          <span class="text-muted-foreground">▾</span>
        </MenuTrigger>
        <MenuContent class="min-w-[120px]">
          <For each={HEADING_OPTIONS}>
            {(option) => (
              <MenuItem
                class={
                  option.level === null ? "text-meta" : "text-meta font-bold"
                }
                onSelect={() => {
                  if (option.level === null) chain().setParagraph().run();
                  else chain().toggleHeading({ level: option.level }).run();
                }}
              >
                {option.label}
              </MenuItem>
            )}
          </For>
        </MenuContent>
      </Menu>

      <ToolbarSeparator />

      <ToolbarButton
        dataAction="bullet-list"
        title="Bullet list"
        active={active("bulletList")}
        onClick={() => chain().toggleBulletList().run()}
      >
        •—
      </ToolbarButton>
      <ToolbarButton
        dataAction="ordered-list"
        title="Ordered list"
        active={active("orderedList")}
        onClick={() => chain().toggleOrderedList().run()}
      >
        1.
      </ToolbarButton>
      <ToolbarButton
        dataAction="blockquote"
        title="Blockquote"
        active={active("blockquote")}
        onClick={() => chain().toggleBlockquote().run()}
      >
        "
      </ToolbarButton>
      <ToolbarButton
        dataAction="code-block"
        title="Code block"
        active={active("codeBlock")}
        onClick={() => chain().toggleCodeBlock().run()}
      >
        {"{ }"}
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarDropdown
        dataDropdown="color"
        title="Text color"
        label={
          <span
            style={{
              color:
                props.editor.getAttributes("textStyle")?.color ?? undefined,
            }}
          >
            A
          </span>
        }
      >
        <ColorPicker
          activeColor={
            (props.editor.getAttributes("textStyle")?.color as
              | string
              | undefined) ?? null
          }
          onSelect={(color) => {
            if (color) chain().setColor(color).run();
            else chain().unsetColor().run();
          }}
        />
      </ToolbarDropdown>

      <ToolbarButton
        dataAction="link"
        title="Link"
        active={active("link")}
        onClick={() => {
          if (active("link")) {
            chain().unsetLink().run();
          } else {
            const url = prompt("Enter URL:");
            if (url) chain().setLink({ href: url }).run();
          }
        }}
      >
        🔗
      </ToolbarButton>

      <ToolbarButton
        dataAction="image"
        title="Image"
        onClick={props.onImageClick}
      >
        🖼
      </ToolbarButton>

      <ToolbarDropdown
        dataDropdown="emoji"
        title="Emoji"
        label={<span>😀</span>}
      >
        <EmojiPicker onSelect={(emoji) => chain().insertContent(emoji).run()} />
      </ToolbarDropdown>

      <ToolbarSeparator />

      <ToolbarButton
        dataAction="undo"
        title="Undo"
        disabled={!props.editor.can().undo()}
        onClick={() => chain().undo().run()}
      >
        ↩
      </ToolbarButton>
      <ToolbarButton
        dataAction="redo"
        title="Redo"
        disabled={!props.editor.can().redo()}
        onClick={() => chain().redo().run()}
      >
        ↪
      </ToolbarButton>
    </div>
  );
};
