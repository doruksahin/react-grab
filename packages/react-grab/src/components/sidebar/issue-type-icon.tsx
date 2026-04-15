import { type Component, Show } from "solid-js";

interface IssueTypeIconProps {
  issueType: string | null | undefined;
}

const ICON_PATHS: Record<string, { path: string; colorClass: string }> = {
  Bug: {
    path: "M8 3a5 5 0 100 10A5 5 0 008 3z",
    colorClass: "text-red-400",
  },
  Task: {
    path: "M3 3h10v10H3V3zm2 5l2 2 4-4",
    colorClass: "text-blue-400",
  },
  Story: {
    path: "M4 2h8a1 1 0 011 1v11l-5-3-5 3V3a1 1 0 011-1z",
    colorClass: "text-green-400",
  },
  Epic: {
    path: "M9 1L4 9h4l-1 6 5-8H8l1-6z",
    colorClass: "text-purple-400",
  },
};

const getConfig = (
  issueType: string | null | undefined,
): { path: string; colorClass: string } | null => {
  if (!issueType) return null;
  return ICON_PATHS[issueType] ?? null;
};

export const IssueTypeIcon: Component<IssueTypeIconProps> = (props) => {
  const config = () => getConfig(props.issueType);

  return (
    <Show when={config()}>
      {(c) => (
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          class={c().colorClass}
        >
          <path d={c().path} fill="currentColor" />
        </svg>
      )}
    </Show>
  );
};
