import { type Component, createSignal, Show } from "solid-js";
import type { SelectionGroup } from "../../features/selection-groups/types.js";
import { GroupPickerFlyout } from "../../features/selection-groups/components/group-picker-flyout.js";
import { Button } from "../ui/button.js";

interface BulkGroupPickerProps {
  groups: SelectionGroup[];
  onSelect: (groupId: string) => void;
  onAddGroup?: (name: string) => void;
}

export const BulkGroupPicker: Component<BulkGroupPickerProps> = (props) => {
  const [isOpen, setOpen] = createSignal(false);

  return (
    <div data-react-grab-bulk-group-picker class="relative">
      <Button
        variant="bulk"
        size="xs"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        Move to group
      </Button>
      <Show when={isOpen()}>
        <GroupPickerFlyout
          groups={props.groups}
          activeGroupId={null}
          onSelect={(groupId) => {
            if (groupId !== null) props.onSelect(groupId);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          onAddGroup={props.onAddGroup}
          placement="top"
        />
      </Show>
    </div>
  );
};
