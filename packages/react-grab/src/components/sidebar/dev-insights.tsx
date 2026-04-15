import { type Component, createSignal, Show } from "solid-js";

interface DevInsightsProps {
  tagName: string;
  componentName?: string;
  content?: string;
}

const MAX_HTML_LENGTH = 200;

export const DevInsights: Component<DevInsightsProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);

  const truncatedContent = () => {
    const raw = props.content;
    if (!raw) return undefined;
    return raw.length > MAX_HTML_LENGTH
      ? `${raw.slice(0, MAX_HTML_LENGTH)}...`
      : raw;
  };

  return (
    <div>
      <div
        class="text-[9px] font-extrabold text-sky-500 mt-1 flex items-center gap-1 opacity-70 cursor-pointer hover:opacity-100"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span>DEV INSIGHTS</span>
        <span
          class="transition-transform"
          style={{
            display: "inline-block",
            transform: isOpen() ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          {"\u25BC"}
        </span>
      </div>

      <Show when={isOpen()}>
        <div class="mt-2.5 bg-foreground/[0.02] border border-border rounded-md p-2.5 font-mono text-[9px] text-muted-foreground leading-relaxed border-l-2 border-l-sky-500 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]">
          <div>
            <b class="text-sky-500 font-bold lowercase">tag:</b> {props.tagName}
          </div>
          <div>
            <b class="text-sky-500 font-bold lowercase">node:</b>{" "}
            {props.componentName ?? "\u2014"}
          </div>
          <Show when={truncatedContent()}>
            <div>
              <b class="text-sky-500 font-bold lowercase">html:</b>{" "}
              {truncatedContent()}
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};
