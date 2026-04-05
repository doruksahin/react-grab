import type { Component } from "solid-js";
import type { GroupedEntry } from "../../features/sidebar";
import { deriveStatus } from "../../features/sidebar";

interface StatsBarProps {
  groupedItems: GroupedEntry[];
}

export const StatsBar: Component<StatsBarProps> = (props) => {
  const stats = () => {
    const items = props.groupedItems;
    const totalSelections = items.reduce((sum, e) => sum + e.items.length, 0);
    return {
      groups: items.length,
      selections: totalSelections,
      open: items.filter((e) => deriveStatus(e) === "open").length,
      ticketed: items.filter((e) => deriveStatus(e) === "ticketed").length,
    };
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
