import { type Component, For } from "solid-js";
import type { GroupedEntry } from "../../features/sidebar/index.js";
import { GroupCard } from "./group-card.js";

interface GroupListProps {
  groupedItems: GroupedEntry[];
  onGroupClick: (groupId: string, cardEl: HTMLElement) => void;
}

export const GroupList: Component<GroupListProps> = (props) => {
  return (
    <div data-react-grab-group-list class="p-2">
      <For each={props.groupedItems}>
        {(entry) => (
          <GroupCard
            entry={entry}
            onDetailOpen={props.onGroupClick}
          />
        )}
      </For>
    </div>
  );
};
