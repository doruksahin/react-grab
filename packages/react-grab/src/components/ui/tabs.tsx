import { Tabs as TabsPrimitive } from "@kobalte/core/tabs";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../utils/cn.js";

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
        "inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 border border-border bg-accent/50 px-2 py-1.5 text-meta font-semibold text-muted-foreground transition-colors first:rounded-l-lg first:border-r-0 last:rounded-r-lg hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[selected]:bg-accent data-[selected]:text-foreground data-[selected]:inset-shadow-tab",
        local.class,
      )}
      {...rest}
    />
  );
};

export { Tabs, TabsList, TabsTrigger };
