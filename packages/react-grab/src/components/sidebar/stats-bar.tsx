import type { Component } from "solid-js";
import type { GroupedEntry } from "../../features/sidebar";
import { deriveStatus } from "../../features/sidebar";

interface StatsBarProps {
  groupedItems: GroupedEntry[];
}

export const StatsBar: Component<StatsBarProps> = (props) => {
  const stats = () => {
    const items = props.groupedItems;
    return items.reduce(
      (acc, e) => {
        const s = deriveStatus(e);
        return {
          groups: acc.groups + 1,
          selections: acc.selections + e.items.length,
          open: acc.open + (s === "open" ? 1 : 0),
          ticketed: acc.ticketed + (s === "ticketed" ? 1 : 0),
        };
      },
      { groups: 0, selections: 0, open: 0, ticketed: 0 },
    );
  };

  return (
    <div class="flex border-b border-white/10">
      <StatCell value={stats().groups} label="Groups" />
      <StatCell value={stats().selections} label="Items" />
      <StatCell value={stats().open} label="Open" />
      <StatCell value={stats().ticketed} label="Ticketed" />
    </div>
  );
};

const StatCell: Component<{ value: number; label: string }> = (props) => (
  <div class="flex-1 text-center py-2.5 px-1">
    <div class="text-lg font-bold text-white">{props.value}</div>
    <div class="text-[10px] text-white/40 uppercase tracking-wider">{props.label}</div>
  </div>
);
