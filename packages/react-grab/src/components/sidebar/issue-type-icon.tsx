import { type Component, Show } from "solid-js";
import { resolveIssueTypeIcon } from "../../features/jira-ticket/issue-type-icons.js";

const ICON_SIZE_PX = 12;

interface IssueTypeIconProps {
  issueType: string | null | undefined;
}

export const IssueTypeIcon: Component<IssueTypeIconProps> = (props) => {
  const spec = () => resolveIssueTypeIcon(props.issueType);

  return (
    <Show when={spec()}>
      {(s) => (
        <svg width={ICON_SIZE_PX} height={ICON_SIZE_PX} viewBox="0 0 16 16">
          <path
            d={s().path}
            fill={s().color}
            fill-rule={s().evenodd ? "evenodd" : undefined}
            clip-rule={s().evenodd ? "evenodd" : undefined}
          />
        </svg>
      )}
    </Show>
  );
};
