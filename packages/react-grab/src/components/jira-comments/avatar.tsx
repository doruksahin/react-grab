import { type Component, Show } from "solid-js";
import { initials, avatarColor } from "../../features/jira-comments/avatar-utils.js";

export const Avatar: Component<{ name: string; url: string | null; size?: number }> = (props) => {
  const sz = () => props.size ?? 20;
  return (
    <Show
      when={props.url}
      fallback={
        <div
          class="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
          style={{
            width: `${sz()}px`,
            height: `${sz()}px`,
            "font-size": `${Math.round(sz() * 0.4)}px`,
            background: avatarColor(props.name),
          }}
        >
          {initials(props.name)}
        </div>
      }
    >
      <img
        src={props.url!}
        alt={props.name}
        class="rounded-full flex-shrink-0"
        style={{ width: `${sz()}px`, height: `${sz()}px` }}
      />
    </Show>
  );
};
