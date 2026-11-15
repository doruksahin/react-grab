import { type Component, For } from "solid-js";
import { Button } from "../../ui/button.js";

const COMMON_EMOJI = [
  "😀",
  "😂",
  "😍",
  "🤔",
  "👍",
  "👎",
  "🎉",
  "🔥",
  "❤️",
  "💯",
  "✅",
  "❌",
  "⚡",
  "💡",
  "🚀",
  "👀",
  "🙏",
  "👋",
  "💪",
  "🎯",
  "⭐",
  "📌",
  "🔑",
  "🛠️",
];

export const EmojiPicker: Component<{
  onSelect: (emoji: string) => void;
}> = (props) => (
  <div
    data-react-grab-emoji-picker
    class="grid gap-0.5 p-2"
    style={{ "grid-template-columns": "repeat(8, 1fr)", "min-width": "220px" }}
    data-react-grab-ignore-events
  >
    <For each={COMMON_EMOJI}>
      {(emoji) => (
        <Button
          type="button"
          data-react-grab-emoji={emoji}
          variant="ghost"
          size="icon-sm"
          class="text-base leading-none"
          onMouseDown={(e) => {
            e.preventDefault();
            props.onSelect(emoji);
          }}
        >
          {emoji}
        </Button>
      )}
    </For>
  </div>
);
