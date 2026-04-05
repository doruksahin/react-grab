// packages/react-grab/src/components/sidebar/group-detail-view.tsx
import { type Component } from "solid-js";
import type { SelectionGroup } from "../../features/selection-groups/types";
import type { CommentItem } from "../../types";
import { DetailHeader } from "./detail-header";
import { SelectionList } from "./selection-list";

interface GroupDetailViewProps {
  ref?: (el: HTMLDivElement) => void;
  group: SelectionGroup;
  commentItems: CommentItem[];
  syncServerUrl?: string;
  syncWorkspace?: string;
  onBack: () => void;
}

export const GroupDetailView: Component<GroupDetailViewProps> = (props) => {
  const groupItems = () =>
    props.commentItems.filter((c) => c.groupId === props.group.id);

  return (
    <div
      tabIndex={-1}
      ref={props.ref}
      class="flex flex-col flex-1 overflow-hidden outline-none"
      style={{ "pointer-events": "auto" }}
      aria-label={`Detail: ${props.group.name}`}
      role="region"
    >
      <DetailHeader group={props.group} onBack={props.onBack} />
      <SelectionList
        items={groupItems()}
        syncServerUrl={props.syncServerUrl}
        syncWorkspace={props.syncWorkspace}
      />
    </div>
  );
};
