import { type Component, For } from "solid-js";
import type { GroupedEntry } from "../../features/sidebar";
import { GroupCard } from "./group-card";

interface GroupListProps {
  groupedItems: GroupedEntry[];
  onGroupClick: (groupId: string, cardEl: HTMLElement) => void;
}

export const GroupList: Component<GroupListProps> = (props) => {
  return (
    <div class="flex-1 overflow-y-auto p-2">
      <For each={props.groupedItems}>
        {(entry) => (
          <GroupCard
            entry={entry}
            onClick={props.onGroupClick}
          />
        )}
      </For>
    </div>
  );
};
