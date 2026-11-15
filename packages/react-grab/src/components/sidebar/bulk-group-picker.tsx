import { type Component, createSignal } from "solid-js";
import type { SelectionGroup } from "../../features/selection-groups/types.js";
import {
  GroupPickerFlyout,
  GroupPickerPopover,
  GroupPickerTrigger,
} from "../selection-groups/group-picker-flyout.js";
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
      <GroupPickerPopover
        open={isOpen()}
        onOpenChange={setOpen}
        placement="top"
      >
        <GroupPickerTrigger
          as={Button}
          variant="bulk"
          size="xs"
          onClick={(event: MouseEvent) => event.stopPropagation()}
        >
          Move to group
        </GroupPickerTrigger>
        <GroupPickerFlyout
          groups={props.groups}
          activeGroupId={null}
          onSelect={(groupId) => {
            if (groupId !== null) props.onSelect(groupId);
            setOpen(false);
          }}
          onAddGroup={props.onAddGroup}
        />
      </GroupPickerPopover>
    </div>
  );
};
