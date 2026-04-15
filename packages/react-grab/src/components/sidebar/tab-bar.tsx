import type { Component } from "solid-js";

export interface TabBarProps {
  activeTab: "groups" | "selections";
  onTabChange: (tab: "groups" | "selections") => void;
  groupsCount: number;
  selectionsCount: number;
}

interface TabConfig {
  id: "groups" | "selections";
  label: string;
  count: number;
}

export const TabBar: Component<TabBarProps> = (props) => {
  const tabs = (): TabConfig[] => [
    { id: "groups", label: "Groups", count: props.groupsCount },
    { id: "selections", label: "Selections", count: props.selectionsCount },
  ];

  return (
    <div class="flex border-b border-border px-3 pt-2 pb-0">
      {tabs().map((tab, index) => {
        const isActive = () => props.activeTab === tab.id;
        const isFirst = index === 0;
        const isLast = index === tabs().length - 1;

        return (
          <button
            type="button"
            class="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 font-semibold text-[11px] cursor-pointer border border-border transition-colors"
            classList={{
              "rounded-l-lg border-r-0": isFirst,
              "rounded-r-lg": isLast,
              "bg-accent text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]": isActive(),
              "bg-accent/50 text-muted-foreground hover:bg-accent/70": !isActive(),
            }}
            onClick={() => props.onTabChange(tab.id)}
          >
            {tab.label}
            <span
              class="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none"
              classList={{
                "text-purple-400 bg-purple-400/10": isActive(),
                "text-muted-foreground bg-foreground/5": !isActive(),
              }}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
