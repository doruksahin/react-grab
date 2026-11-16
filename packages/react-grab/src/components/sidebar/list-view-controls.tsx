import { type Component, For } from "solid-js";
import {
  SELECTION_ORDER_LABEL,
  type SelectionOrder,
} from "../../features/sidebar/business/order-selections.js";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group.js";
import {
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "../ui/menu.js";
import { ChevronIcon } from "../ui/chevron-icon.jsx";

/** How the sidebar list groups its selections. */
export type SelectionGrouping = "group" | "status";

interface ListViewControlsProps {
  grouping: SelectionGrouping;
  onGroupingChange: (grouping: SelectionGrouping) => void;
  order: SelectionOrder;
  onOrderChange: (order: SelectionOrder) => void;
}

const ORDERS: SelectionOrder[] = ["attention", "newest"];

const isGrouping = (value: string): value is SelectionGrouping =>
  value === "group" || value === "status";

const isOrder = (value: string): value is SelectionOrder =>
  value === "attention" || value === "newest";

/**
 * How the list is laid out, apart from what it shows (the filters): group
 * by group or by status, and the order within each section.
 */
export const ListViewControls: Component<ListViewControlsProps> = (props) => (
  <div
    data-react-grab-list-view-controls
    class="flex items-center justify-between gap-2 px-4 py-1.5 border-b border-border text-meta text-muted-foreground"
  >
    <div class="flex items-center gap-1.5">
      <span>Group by</span>
      <ToggleGroup
        aria-label="Group by"
        variant="segment"
        value={props.grouping}
        onChange={(value) => {
          if (value && isGrouping(value)) props.onGroupingChange(value);
        }}
      >
        <ToggleGroupItem value="group">Group</ToggleGroupItem>
        <ToggleGroupItem value="status">Status</ToggleGroupItem>
      </ToggleGroup>
    </div>
    <Menu modal={false} placement="bottom-end" gutter={4}>
      <MenuTrigger
        data-react-grab-list-order
        variant="toolbar"
        aria-label="Order"
      >
        {SELECTION_ORDER_LABEL[props.order]}
        <ChevronIcon size={10} />
      </MenuTrigger>
      <MenuContent data-react-grab-ignore-events class="min-w-[10rem]">
        <MenuRadioGroup
          value={props.order}
          onChange={(value) => {
            if (isOrder(value)) props.onOrderChange(value);
          }}
        >
          <For each={ORDERS}>
            {(order) => (
              <MenuRadioItem value={order} closeOnSelect>
                {SELECTION_ORDER_LABEL[order]}
              </MenuRadioItem>
            )}
          </For>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  </div>
);
