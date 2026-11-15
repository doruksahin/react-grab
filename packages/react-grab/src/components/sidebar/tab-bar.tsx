import { type Component, For } from "solid-js";
import { TabsCount, TabsList, TabsTrigger } from "../ui/tabs.js";

export interface TabBarProps {
  groupsCount: number;
  selectionsCount: number;
}

interface TabConfig {
  id: "groups" | "selections";
  label: string;
  count: number;
}

/** The tab list of the sidebar's Tabs root (components/sidebar/index.tsx). */
export const TabBar: Component<TabBarProps> = (props) => {
  const tabs = (): TabConfig[] => [
    { id: "groups", label: "Groups", count: props.groupsCount },
    { id: "selections", label: "Selections", count: props.selectionsCount },
  ];

  return (
    <TabsList
      data-react-grab-tab-bar
      aria-label="Dashboard view"
      class="border-b border-border px-2 py-1.5"
    >
      <For each={tabs()}>
        {(tab) => (
          <TabsTrigger value={tab.id}>
            {tab.label}
            <TabsCount>{tab.count}</TabsCount>
          </TabsTrigger>
        )}
      </For>
    </TabsList>
  );
};
