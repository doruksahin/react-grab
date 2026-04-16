import { type Component, Show } from "solid-js";

interface IssueTypeIconProps {
  issueType: string | null | undefined;
}

interface IconSpec {
  path: string;
  color: string;
  evenodd?: boolean;
}

const ICON_SIZE_PX = 12;

const ICONS: Record<string, IconSpec> = {
  Story: {
    path: "M11.518 3a.5.5 0 0 0-.5-.5H4.983a.5.5 0 0 0-.5.5v9.806L8 10.333l.431.304 3.087 2.169zm1.5 11.202a.776.776 0 0 1-1.122.694l-.099-.06L8 12.166l-3.796 2.67a.775.775 0 0 1-1.22-.634V3a2 2 0 0 1 2-2h6.035a2 2 0 0 1 2 2z",
    color: "#22A06B",
  },
  Task: {
    path: "M1 3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2zm2-.5a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V3a.5.5 0 0 0-.5-.5zm9.326 2.98-5 6a.75.75 0 0 1-1.152 0l-2.5-3 1.152-.96L6.75 9.828l4.424-5.308z",
    color: "#357DE8",
    evenodd: true,
  },
  Bug: {
    path: "M8 2.5A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 8 2.5m3 1.52V4a3 3 0 0 0-6 0v.02c-.29.05-.553.182-.761.372l-.887-.633-.917-2.064-1.37.61.944 2.125c.09.204.234.38.416.51l1.325.946V7H.5v1.5h3.25v1.149l-1.15.958a1.25 1.25 0 0 0-.318.401L1.08 13.415l1.342.67 1.18-2.36.46-.383A4.25 4.25 0 0 0 8.001 14h.249A4 4 0 0 0 12 11.393l.4.333 1.18 2.36 1.34-.671-1.202-2.407a1.25 1.25 0 0 0-.318-.401l-1.15-.958V8.5h3.25V7h-3.25V5.886l1.325-.946a1.25 1.25 0 0 0 .416-.51l.944-2.125-1.37-.61-.917 2.064-.887.633A1.5 1.5 0 0 0 11 4.02M10.75 10V5.5h-5.5v4.443l.035.226A2.75 2.75 0 0 0 8 12.5h.249a2.5 2.5 0 0 0 2.5-2.5",
    color: "#C9372C",
    evenodd: true,
  },
  Epic: {
    path: "M10.271.05a.75.75 0 0 1 .479.7v4.635l3.147.63a.75.75 0 0 1 .407 1.24l-7.75 8.5a.75.75 0 0 1-1.304-.505v-4.635l-3.147-.63a.75.75 0 0 1-.407-1.24l7.75-8.5A.75.75 0 0 1 10.27.05M3.698 8.776l3.052.61v3.93l5.552-6.09-3.052-.61v-3.93z",
    color: "#AF59E1",
    evenodd: true,
  },
  Subtask: {
    path: "M13.5 9.25a.5.5 0 0 0-.5-.5H8.75V13a.5.5 0 0 0 .5.5H13a.5.5 0 0 0 .5-.5zM7.25 3a.5.5 0 0 0-.5-.5H3a.5.5 0 0 0-.5.5v3.75a.5.5 0 0 0 .5.5h4.25zm1.5 4.25H13a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2H9.25a2 2 0 0 1-2-2V8.75H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h3.75a2 2 0 0 1 2 2z",
    color: "#357DE8",
  },
};

const ALIASES: Record<string, string> = {
  "Sub-task": "Subtask",
  "Sub task": "Subtask",
  Subtasks: "Subtask",
};

const resolve = (issueType: string | null | undefined): IconSpec | null => {
  if (!issueType) return null;
  const key = ALIASES[issueType] ?? issueType;
  return ICONS[key] ?? null;
};

export const IssueTypeIcon: Component<IssueTypeIconProps> = (props) => {
  const spec = () => resolve(props.issueType);

  return (
    <Show when={spec()}>
      {(s) => (
        <svg
          width={ICON_SIZE_PX}
          height={ICON_SIZE_PX}
          viewBox="0 0 16 16"
        >
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
