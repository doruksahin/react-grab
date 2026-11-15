import { type Component, For } from "solid-js";
import { Badge } from "../ui/badge.js";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs.js";

type TabId = "groups" | "selections";

export interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  groupsCount: number;
  selectionsCount: number;
}

interface TabConfig {
  id: TabId;
  label: string;
  count: number;
}

export const TabBar: Component<TabBarProps> = (props) => {
  const tabs = (): TabConfig[] => [
    { id: "groups", label: "Groups", count: props.groupsCount },
    { id: "selections", label: "Selections", count: props.selectionsCount },
  ];

  const handleChange = (value: string) => {
    const tab = tabs().find((candidate) => candidate.id === value);
    if (tab) props.onTabChange(tab.id);
  };

  return (
    <Tabs
      data-react-grab-tab-bar
      value={props.activeTab}
      onChange={handleChange}
      class="border-b border-border px-2 py-1.5"
    >
      <TabsList aria-label="Dashboard view">
        <For each={tabs()}>
          {(tab) => (
            <TabsTrigger value={tab.id}>
              {tab.label}
              <Badge
                variant="count"
                tone={props.activeTab === tab.id ? "accent" : "neutral"}
              >
                {tab.count}
              </Badge>
            </TabsTrigger>
          )}
        </For>
      </TabsList>
    </Tabs>
  );
};
