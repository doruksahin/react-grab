import { type Component, Show } from "solid-js";
import type { FilterState } from "../../features/sidebar/filter-state.js";
import { ALL_ATT_STATUSES } from "../../features/sidebar/status-colors.js";
import { Button } from "../ui/button.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select.js";

interface FilterBarProps {
  filter: FilterState;
  assignees: string[];
  reporters: string[];
  labels: string[];
  onFilterChange: (filter: FilterState) => void;
}

export const FilterBar: Component<FilterBarProps> = (props) => {
  const handleStatusChange = (value: string | null) => {
    const statuses = value ? new Set([value]) : new Set<string>();
    props.onFilterChange({ ...props.filter, statuses });
  };

  const handleAssigneeChange = (value: string | null) => {
    props.onFilterChange({ ...props.filter, assignee: value || null });
  };

  const handleReporterChange = (value: string | null) => {
    props.onFilterChange({ ...props.filter, reporter: value || null });
  };

  const handleLabelChange = (value: string | null) => {
    props.onFilterChange({ ...props.filter, label: value || null });
  };

  const hasActiveFilter = () =>
    props.filter.statuses.size > 0 ||
    props.filter.assignee !== null ||
    props.filter.reporter !== null ||
    props.filter.label !== null;

  const handleClear = () => {
    props.onFilterChange({ statuses: new Set(), assignee: null, reporter: null, label: null });
  };

  const triggerClass = "flex-1 min-w-0 text-[11px] h-7 bg-muted border-border text-foreground";

  return (
    <div class="flex gap-1.5 px-4 py-2 border-b border-border items-center flex-wrap">
      <Select
        value={[...props.filter.statuses][0] ?? ""}
        onChange={handleStatusChange}
        options={["", "No Task", ...ALL_ATT_STATUSES]}
        itemComponent={(itemProps) => (
          <SelectItem item={itemProps.item}>
            {itemProps.item.rawValue === "" ? "All Statuses" : itemProps.item.rawValue}
          </SelectItem>
        )}
      >
        <SelectTrigger class={triggerClass}>
          <SelectValue<string>>
            {(state) => state.selectedOption() || "All Statuses"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>

      <Select
        value={props.filter.assignee ?? ""}
        onChange={handleAssigneeChange}
        options={["", ...props.assignees]}
        itemComponent={(itemProps) => (
          <SelectItem item={itemProps.item}>
            {itemProps.item.rawValue === "" ? "All Assignees" : itemProps.item.rawValue}
          </SelectItem>
        )}
      >
        <SelectTrigger class={triggerClass}>
          <SelectValue<string>>
            {(state) => state.selectedOption() || "All Assignees"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>

      <Select
        value={props.filter.reporter ?? ""}
        onChange={handleReporterChange}
        options={["", ...props.reporters]}
        itemComponent={(itemProps) => (
          <SelectItem item={itemProps.item}>
            {itemProps.item.rawValue === "" ? "All Reporters" : itemProps.item.rawValue}
          </SelectItem>
        )}
      >
        <SelectTrigger class={triggerClass}>
          <SelectValue<string>>
            {(state) => state.selectedOption() || "All Reporters"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>

      <Show when={props.labels.length > 0}>
        <Select
          value={props.filter.label ?? ""}
          onChange={handleLabelChange}
          options={["", ...props.labels]}
          itemComponent={(itemProps) => (
            <SelectItem item={itemProps.item}>
              {itemProps.item.rawValue === "" ? "All Labels" : itemProps.item.rawValue}
            </SelectItem>
          )}
        >
          <SelectTrigger class={triggerClass}>
            <SelectValue<string>>
              {(state) => state.selectedOption() || "All Labels"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
      </Show>

      <Show when={hasActiveFilter()}>
        <Button variant="ghost" size="sm" class="text-[10px] text-muted-foreground hover:text-foreground h-auto py-0.5 px-1.5 whitespace-nowrap" onClick={handleClear}>
          ✕ Clear
        </Button>
      </Show>
    </div>
  );
};
