import { Tabs as TabsPrimitive } from "@kobalte/core/tabs";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";
import { Badge } from "./badge.js";

const Tabs: Component<ComponentProps<typeof TabsPrimitive>> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return <TabsPrimitive class={cn("flex flex-col", local.class)} {...rest} />;
};

const TabsList: Component<ComponentProps<typeof TabsPrimitive.List>> = (
  props,
) => {
  const [local, rest] = splitProps(props, ["class"]);
  return <TabsPrimitive.List class={cn("flex", local.class)} {...rest} />;
};

// A segmented control: the first and last trigger round the outer corners.
const TabsTrigger: Component<ComponentProps<typeof TabsPrimitive.Trigger>> = (
  props,
) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <TabsPrimitive.Trigger
      class={cn(
        "group/tab inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 border border-border bg-accent/50 px-2 py-1.5 text-meta font-semibold text-muted-foreground transition-colors first:rounded-l-lg first:border-r-0 last:rounded-r-lg hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[selected]:bg-accent data-[selected]:text-foreground data-[selected]:inset-shadow-tab",
        local.class,
      )}
      {...rest}
    />
  );
};

// A count inside a trigger; it takes the selected tone from its trigger.
const TabsCount: Component<ComponentProps<"span">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <Badge
      variant="count"
      class={cn(
        "group-data-[selected]/tab:bg-selection/10 group-data-[selected]/tab:text-selection",
        local.class,
      )}
      {...rest}
    />
  );
};

const TabsContent: Component<ComponentProps<typeof TabsPrimitive.Content>> = (
  props,
) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <TabsPrimitive.Content
      class={cn(
        "flex min-h-0 flex-1 flex-col outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
        local.class,
      )}
      {...rest}
    />
  );
};

export { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger };
