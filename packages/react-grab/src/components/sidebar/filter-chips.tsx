import { type Component, Show, For } from "solid-js";
import type { FilterState } from "../../features/sidebar/filter-state.js";

interface FilterChipsProps {
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
}

export const FilterChips: Component<FilterChipsProps> = (props) => {
  const chips = () => {
    const result: { label: string; onDismiss: () => void }[] = [];
    for (const status of props.filter.statuses) {
      result.push({
        label: `Status: ${status}`,
        onDismiss: () => {
          const next = new Set(props.filter.statuses);
          next.delete(status);
          props.onFilterChange({ ...props.filter, statuses: next });
        },
      });
    }
    if (props.filter.assignee) {
      result.push({
        label: `Assignee: ${props.filter.assignee}`,
        onDismiss: () => props.onFilterChange({ ...props.filter, assignee: null }),
      });
    }
    if (props.filter.reporter) {
      result.push({
        label: `Reporter: ${props.filter.reporter}`,
        onDismiss: () => props.onFilterChange({ ...props.filter, reporter: null }),
      });
    }
    if (props.filter.label) {
      result.push({
        label: `Label: ${props.filter.label}`,
        onDismiss: () => props.onFilterChange({ ...props.filter, label: null }),
      });
    }
    return result;
  };

  return (
    <Show when={chips().length > 0}>
      <div class="flex flex-wrap gap-1.5 px-4 py-1.5">
        <For each={chips()}>
          {(chip) => (
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-[10px] text-foreground">
              {chip.label}
              <button
                class="text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={chip.onDismiss}
              >
                ✕
              </button>
            </span>
          )}
        </For>
      </div>
    </Show>
  );
};
