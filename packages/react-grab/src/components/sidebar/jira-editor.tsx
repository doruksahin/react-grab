import { type Component, createSignal, onCleanup, onMount } from "solid-js";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

interface JiraEditorProps {
  initialValue?: string;
  onChange?: (markdown: string) => void;
}

const ToolbarButton: Component<{
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: any;
}> = (props) => (
  <button
    type="button"
    title={props.title}
    disabled={props.disabled}
    onMouseDown={(e) => {
      e.preventDefault(); // keep editor focus + selection intact
      if (!props.disabled) props.onClick();
    }}
    class={[
      "px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors",
      props.active
        ? "bg-white/20 text-white"
        : "text-white/60 hover:text-white hover:bg-white/10",
      props.disabled ? "opacity-30 cursor-not-allowed" : "",
    ].join(" ")}
    style={{ "pointer-events": "auto" }}
  >
    {props.children}
  </button>
);

export const JiraEditor: Component<JiraEditorProps> = (props) => {
  let editorEl!: HTMLDivElement;
  let editor: Editor | undefined;
  const [, tick] = createSignal(0);

  onMount(() => {
    editor = new Editor({
      element: editorEl,
      extensions: [
        StarterKit,
        Markdown.configure({ html: false, transformPastedText: true }),
      ],
      content: props.initialValue ?? "",
      onTransaction: () => tick((n) => n + 1),
      onUpdate: ({ editor: e }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        props.onChange?.((e.storage as any).markdown.getMarkdown());
      },
    });
  });

  onCleanup(() => editor?.destroy());

  const active = (name: string, attrs?: Record<string, unknown>) =>
    editor?.isActive(name, attrs) ?? false;

  const run = (cmd: () => boolean) => {
    cmd();
  };

  return (
    <div
      class="flex flex-col rounded border border-white/10 bg-black/20 overflow-hidden"
      style={{ "pointer-events": "auto" }}
    >
      {/* Toolbar */}
      <div class="flex flex-wrap gap-0.5 px-2 py-1.5 border-b border-white/10 bg-white/5">
        <ToolbarButton
          title="Bold"
          active={active("bold")}
          onClick={() => run(() => editor!.chain().toggleBold().run())}
        >
          <b>B</b>
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={active("italic")}
          onClick={() => run(() => editor!.chain().toggleItalic().run())}
        >
          <i>I</i>
        </ToolbarButton>
        <ToolbarButton
          title="Strike"
          active={active("strike")}
          onClick={() => run(() => editor!.chain().toggleStrike().run())}
        >
          <s>S</s>
        </ToolbarButton>
        <ToolbarButton
          title="Inline code"
          active={active("code")}
          onClick={() => run(() => editor!.chain().toggleCode().run())}
        >
          {"<>"}
        </ToolbarButton>

        <span class="w-px bg-white/10 mx-1 self-stretch" />

        <ToolbarButton
          title="Heading 1"
          active={active("heading", { level: 1 })}
          onClick={() => run(() => editor!.chain().toggleHeading({ level: 1 }).run())}
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          title="Heading 2"
          active={active("heading", { level: 2 })}
          onClick={() => run(() => editor!.chain().toggleHeading({ level: 2 }).run())}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          title="Heading 3"
          active={active("heading", { level: 3 })}
          onClick={() => run(() => editor!.chain().toggleHeading({ level: 3 }).run())}
        >
          H3
        </ToolbarButton>

        <span class="w-px bg-white/10 mx-1 self-stretch" />

        <ToolbarButton
          title="Bullet list"
          active={active("bulletList")}
          onClick={() => run(() => editor!.chain().toggleBulletList().run())}
        >
          •—
        </ToolbarButton>
        <ToolbarButton
          title="Ordered list"
          active={active("orderedList")}
          onClick={() => run(() => editor!.chain().toggleOrderedList().run())}
        >
          1.
        </ToolbarButton>
        <ToolbarButton
          title="Blockquote"
          active={active("blockquote")}
          onClick={() => run(() => editor!.chain().toggleBlockquote().run())}
        >
          "
        </ToolbarButton>
        <ToolbarButton
          title="Code block"
          active={active("codeBlock")}
          onClick={() => run(() => editor!.chain().toggleCodeBlock().run())}
        >
          {"{ }"}
        </ToolbarButton>

        <span class="w-px bg-white/10 mx-1 self-stretch" />

        <ToolbarButton
          title="Undo"
          disabled={!editor?.can().undo()}
          onClick={() => run(() => editor!.chain().undo().run())}
        >
          ↩
        </ToolbarButton>
        <ToolbarButton
          title="Redo"
          disabled={!editor?.can().redo()}
          onClick={() => run(() => editor!.chain().redo().run())}
        >
          ↪
        </ToolbarButton>
      </div>

      {/* Editor content area */}
      <div
        ref={editorEl}
        class="jira-editor-content px-3 py-2 min-h-[140px] text-[12px] text-white/90 outline-none"
        style={{ "pointer-events": "auto" }}
      />
    </div>
  );
};
