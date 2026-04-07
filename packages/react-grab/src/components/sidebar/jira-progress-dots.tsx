// packages/react-grab/src/components/sidebar/jira-progress-dots.tsx
import { type Component, For, Show } from "solid-js";

const STAGES = ["Created", "To Do", "In Progress", "Done"] as const;

function activeDotIndex(statusCategory: string | undefined): number {
  switch (statusCategory?.toLowerCase()) {
    case "to do":
      return 1;
    case "in progress":
      return 2;
    case "done":
      return 3;
    default:
      return 0;
  }
}

interface JiraProgressDotsProps {
  statusCategory: string | undefined;
}

export const JiraProgressDots: Component<JiraProgressDotsProps> = (props) => {
  const active = () => activeDotIndex(props.statusCategory);

  return (
    <div data-react-grab-jira-dots class="flex items-center gap-1.5 mt-2" style={{ "pointer-events": "auto" }}>
      <For each={STAGES}>
        {(stage, i) => (
          <>
            <div
              class={`w-2 h-2 rounded-full transition-colors ${
                i() <= active()
                  ? "bg-blue-400"
                  : "bg-accent"
              }`}
              title={stage}
            />
            <Show when={i() < STAGES.length - 1}>
              <div class={`flex-1 h-px ${i() < active() ? "bg-blue-400/50" : "bg-border"}`} />
            </Show>
          </>
        )}
      </For>
    </div>
  );
};
