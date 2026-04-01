import { useState } from "react";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGroupsWithComments } from "@/hooks/use-groups-with-comments";
import type { GroupWithComments } from "@/lib/types";

function deriveGroupStatus(group: GroupWithComments): "open" | "ticketed" | "resolved" {
  if (group.status) return group.status;
  if (group.jiraTicketId) return "ticketed";
  return "open";
}

export default function GroupListPage() {
  const { data: groups, isLoading, error } = useGroupsWithComments();
  const [filter, setFilter] = useState<"all" | "open" | "ticketed" | "resolved">("all");

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (error) return <div className="text-destructive">Error loading data</div>;
  if (!groups) return null;

  const withStatus = groups.map((g) => ({ ...g, derivedStatus: deriveGroupStatus(g) }));
  const filtered = filter === "all" ? withStatus : withStatus.filter((g) => g.derivedStatus === filter);
  const totalSelections = groups.reduce((sum, g) => sum + g.comments.length, 0);

  const stats = {
    groups: groups.length,
    selections: totalSelections,
    open: withStatus.filter((g) => g.derivedStatus === "open").length,
    ticketed: withStatus.filter((g) => g.derivedStatus === "ticketed").length,
    resolved: withStatus.filter((g) => g.derivedStatus === "resolved").length,
  };

  const filters = ["all", "open", "ticketed", "resolved"] as const;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
        <p className="text-sm text-muted-foreground">
          {stats.groups} groups · {stats.selections} selections
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: "Groups", value: stats.groups },
          { label: "Selections", value: stats.selections },
          { label: "Open", value: stats.open, color: "text-blue-500" },
          { label: "Ticketed", value: stats.ticketed, color: "text-yellow-500" },
          { label: "Resolved", value: stats.resolved, color: "text-green-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={`text-2xl font-semibold ${s.color ?? ""}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              filter === f
                ? "bg-foreground text-background border-foreground font-medium"
                : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Group cards */}
      <div className="space-y-3">
        {filtered.map((group) => (
          <Link key={group.id} to={`/groups/${group.id}`} className="block">
            <Card className="hover:border-muted-foreground/30 transition-colors cursor-pointer">
              <CardContent className="p-0">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <div className="font-semibold text-sm">{group.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {group.comments.length} selection{group.comments.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {group.jiraTicketId && (
                      <a
                        href={`https://appier.atlassian.net/browse/${group.jiraTicketId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs font-medium text-blue-500 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {group.jiraTicketId}
                      </a>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        group.derivedStatus === "open" ? "text-blue-500 border-blue-500/30 bg-blue-500/10" :
                        group.derivedStatus === "ticketed" ? "text-yellow-500 border-yellow-500/30 bg-yellow-500/10" :
                        "text-green-500 border-green-500/30 bg-green-500/10"
                      }
                    >
                      {group.derivedStatus.charAt(0).toUpperCase() + group.derivedStatus.slice(1)}
                    </Badge>
                  </div>
                </div>
                {/* Nested comments */}
                {group.comments.length > 0 && (
                  <div className="border-t border-border">
                    {group.comments.map((c) => (
                      <div key={c.id} className="grid grid-cols-[160px_1fr_80px] gap-3 px-5 py-2 text-xs border-t border-border/30 first:border-t-0">
                        <span className="font-mono text-purple-400 font-medium truncate">{c.componentName ?? c.elementName}</span>
                        <span className="text-muted-foreground truncate">{c.commentText ?? ""}</span>
                        <span className="text-muted-foreground font-mono text-right">&lt;{c.tagName}&gt;</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No groups match the filter.
          </div>
        )}
      </div>
    </div>
  );
}
