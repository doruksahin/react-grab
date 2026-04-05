import type { Component } from "solid-js";
import type { GroupStatus } from "../../features/sidebar";
import { cn } from "../../utils/cn";

const statusConfig: Record<GroupStatus, { bg: string; text: string; label: string }> = {
  open: { bg: "bg-blue-500/15", text: "text-blue-400", label: "open" },
  ticketed: { bg: "bg-yellow-500/15", text: "text-yellow-400", label: "ticketed" },
  resolved: { bg: "bg-green-500/15", text: "text-green-400", label: "resolved" },
};

export const StatusBadge: Component<{ status: GroupStatus }> = (props) => {
  const config = () => statusConfig[props.status];
  return (
    <span
      class={cn(
        "text-[10px] px-2 py-0.5 rounded-full font-semibold",
        config().bg,
        config().text,
      )}
    >
      {config().label}
    </span>
  );
};
