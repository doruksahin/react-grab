import { type Component, For } from "solid-js";
import { cn } from "../../utils/cn";

export type FilterStatus = "all" | "open" | "ticketed" | "resolved";

const FILTERS: FilterStatus[] = ["all", "open", "ticketed", "resolved"];

interface FilterTabsProps {
  activeFilter: FilterStatus;
  onFilterChange: (filter: FilterStatus) => void;
}

export const FilterTabs: Component<FilterTabsProps> = (props) => {
  return (
    <div class="flex gap-1.5 px-4 py-2 border-b border-white/10">
      <For each={FILTERS}>
        {(filter) => (
          <button
            class={cn(
              "px-2.5 py-1 rounded-md text-[11px] cursor-pointer transition-colors",
              props.activeFilter === filter
                ? "bg-[var(--color-grab-pink)] text-white"
                : "text-white/40 hover:text-white/70 hover:bg-white/5",
            )}
            onClick={() => props.onFilterChange(filter)}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        )}
      </For>
    </div>
  );
};
