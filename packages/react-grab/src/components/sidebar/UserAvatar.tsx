import { type Component, createSignal, Show } from "solid-js";

interface UserAvatarProps {
  avatarUrl: string | null | undefined;
  displayName: string | null | undefined;
  size?: number;
}

function getInitials(name: string | null | undefined): string {
  if (!name?.trim()) return "";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

export const UserAvatar: Component<UserAvatarProps> = (props) => {
  const size = () => props.size ?? 24;
  const [imgFailed, setImgFailed] = createSignal(false);

  const showImg = () => !!props.avatarUrl && !imgFailed();
  const initials = () => getInitials(props.displayName);

  return (
    <Show when={props.avatarUrl || props.displayName}>
      <Show
        when={showImg()}
        fallback={
          <Show when={initials()}>
            <div
              data-testid="user-avatar-initials"
              style={{
                width: `${size()}px`,
                height: `${size()}px`,
                "border-radius": "50%",
                background: "#64748b",
                color: "#fff",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                "font-size": `${Math.floor(size() * 0.42)}px`,
                "font-weight": "600",
                "flex-shrink": "0",
              }}
            >
              {initials()}
            </div>
          </Show>
        }
      >
        <img
          data-testid="user-avatar-img"
          src={props.avatarUrl!}
          width={size()}
          height={size()}
          style={{ "border-radius": "50%", "flex-shrink": "0" }}
          onError={() => setImgFailed(true)}
          alt={props.displayName ?? ""}
        />
      </Show>
    </Show>
  );
};
