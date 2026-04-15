import type { Component } from "solid-js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import type { CommentItem } from "../../types.js";
import { filterUserFacingGroups } from "../../features/selection-groups/business/synthetic-group.js";
import { ProgressBar } from "./progress-bar.js";

interface StatsBarProps {
  groups: SelectionGroupWithJira[];
  commentItems: CommentItem[];
}

export const StatsBar: Component<StatsBarProps> = (props) => {
  const userFacing = () => filterUserFacingGroups(props.groups);

  const groupStats = () => {
    const groups = userFacing();
    const total = groups.length;
    const linked = groups.filter((g) => Boolean(g.jiraTicketId)).length;
    const flagged = groups.filter((g) => g.jiraFlagged === true).length;
    return { total, linked, flagged };
  };

  const selectionStats = () => {
    const items = props.commentItems;
    const total = items.length;
    const groupMap = new Map(props.groups.map((g) => [g.id, g]));
    let ticketed = 0;
    let flagged = 0;
    for (const item of items) {
      if (!item.groupId) continue;
      const group = groupMap.get(item.groupId);
      if (!group) continue;
      if (group.jiraTicketId) ticketed++;
      if (group.jiraFlagged === true) flagged++;
    }
    return { total, ticketed, flagged };
  };

  return (
    <div data-react-grab-stats-bar class="border-b border-border px-3 py-2.5 space-y-1.5">
      <MetricRow
        label="Groups"
        total={groupStats().total}
        linked={groupStats().linked}
        linkedLabel="Linked"
        flagged={groupStats().flagged}
        progressColor="bg-green-400"
      />
      <MetricRow
        label="Selections"
        total={selectionStats().total}
        linked={selectionStats().ticketed}
        linkedLabel="Ticketed"
        flagged={selectionStats().flagged}
        progressColor="bg-purple-400"
      />
    </div>
  );
};

interface MetricRowProps {
  label: string;
  total: number;
  linked: number;
  linkedLabel: string;
  flagged: number;
  progressColor: string;
}

const MetricRow: Component<MetricRowProps> = (props) => {
  const ratio = () => (props.total > 0 ? props.linked / props.total : 0);

  return (
    <div
      class="grid items-center gap-1.5"
      style={{ "grid-template-columns": "75px 50px 70px 75px 1fr" }}
    >
      <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {props.label}
      </span>
      <span class="text-xs text-foreground">
        Total <span class="font-bold">{props.total}</span>
      </span>
      <span class="text-xs text-foreground">
        {props.linkedLabel} <span class="font-bold">{props.linked}</span>
      </span>
      <span class="text-xs text-red-400">
        Flagged <span class="font-bold">{props.flagged}</span>
      </span>
      <ProgressBar value={ratio()} colorClass={props.progressColor} />
    </div>
  );
};
