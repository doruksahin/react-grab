import { type Component, Show } from "solid-js";
import type { FilterState } from "../../features/sidebar/filter-state.js";
import { ALL_ATT_STATUSES } from "../../features/sidebar/status-colors.js";

interface FilterBarProps {
  filter: FilterState;
  assignees: string[];
  reporters: string[];
  onFilterChange: (filter: FilterState) => void;
}

export const FilterBar: Component<FilterBarProps> = (props) => {
  const handleStatusChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    const statuses = value === "" ? new Set<string>() : new Set([value]);
    props.onFilterChange({ ...props.filter, statuses });
  };

  const handleAssigneeChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    props.onFilterChange({ ...props.filter, assignee: value || null });
  };

  const handleReporterChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    props.onFilterChange({ ...props.filter, reporter: value || null });
  };

  const hasActiveFilter = () =>
    props.filter.statuses.size > 0 ||
    props.filter.assignee !== null ||
    props.filter.reporter !== null;

  const handleClear = () => {
    props.onFilterChange({ statuses: new Set(), assignee: null, reporter: null });
  };

  const selectClass = "bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white/80 cursor-pointer min-w-0 flex-1";

  return (
    <div class="flex gap-1.5 px-4 py-2 border-b border-white/10 items-center">
      <select class={selectClass} onChange={handleStatusChange} value={[...props.filter.statuses][0] ?? ""}>
        <option value="">All Statuses</option>
        <option value="No Task">No Task</option>
        {ALL_ATT_STATUSES.map((s) => (
          <option value={s}>{s}</option>
        ))}
      </select>
      <select class={selectClass} onChange={handleAssigneeChange} value={props.filter.assignee ?? ""}>
        <option value="">All Assignees</option>
        {props.assignees.map((a) => (
          <option value={a}>{a}</option>
        ))}
      </select>
      <select class={selectClass} onChange={handleReporterChange} value={props.filter.reporter ?? ""}>
        <option value="">All Reporters</option>
        {props.reporters.map((r) => (
          <option value={r}>{r}</option>
        ))}
      </select>
      <Show when={hasActiveFilter()}>
        <button
          class="text-[10px] text-white/50 hover:text-white/80 cursor-pointer whitespace-nowrap"
          onClick={handleClear}
        >
          ✕ Clear
        </button>
      </Show>
    </div>
  );
};
