import type { Component } from "solid-js";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";

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
    <div
      data-react-grab-tab-bar
      class="flex border-b border-border px-2 py-1.5"
    >
      {tabs().map((tab, index) => {
        const isActive = () => props.activeTab === tab.id;
        const isFirst = index === 0;
        const isLast = index === tabs().length - 1;

        return (
          <Button
            type="button"
            variant="segment"
            size="segment"
            aria-pressed={isActive()}
            classList={{
              "rounded-l-lg border-r-0": isFirst,
              "rounded-r-lg": isLast,
            }}
            onClick={() => props.onTabChange(tab.id)}
          >
            {tab.label}
            <Badge variant="count" tone={isActive() ? "accent" : "neutral"}>
              {tab.count}
            </Badge>
          </Button>
        );
      })}
    </div>
  );
};
