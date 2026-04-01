import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useListJiraProjects,
  useListJiraIssueTypes,
  useListJiraPriorities,
  useCreateJiraTicket,
} from "@/api/endpoints/jira/jira";
import { WORKSPACE_ID } from "@/lib/config";
import type { GroupWithComments } from "@/lib/types";

interface JiraCreateDialogProps {
  group: GroupWithComments;
  onCreated: (ticketId: string) => void;
}

function generateDescription(group: GroupWithComments): string {
  let desc = `## Group: ${group.name}\n\n`;
  group.comments.forEach((c, i) => {
    desc += `### ${i + 1}. ${c.componentName ?? c.elementName} <${c.tagName}>\n`;
    if (c.commentText) desc += `${c.commentText}\n`;
    if (c.elementSelectors?.[0]) desc += `Selector: \`${c.elementSelectors[0]}\`\n`;
    desc += "\n";
  });
  desc += `## Evidence\nSee attached screenshots (${group.comments.length * 2} images).\n\n_Created by react-grab dashboard_`;
  return desc;
}

function generateSummary(group: GroupWithComments): string {
  const components = group.comments.map((c) => c.componentName ?? c.elementName);
  const unique = [...new Set(components)];
  return `${group.name} — ${unique.join(", ")}`;
}

export function JiraCreateDialog({ group, onCreated }: JiraCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [projectKey, setProjectKey] = useState("");
  const [issueType, setIssueType] = useState("Bug");
  const [priority, setPriority] = useState("Medium");
  const [summary, setSummary] = useState(generateSummary(group));
  const [description, setDescription] = useState(generateDescription(group));

  const projects = useListJiraProjects();
  const issueTypes = useListJiraIssueTypes();
  const priorities = useListJiraPriorities();
  const createTicket = useCreateJiraTicket();

  const handleCreate = () => {
    createTicket.mutate(
      {
        id: WORKSPACE_ID,
        groupId: group.id,
        data: { projectKey, issueType, priority, summary, description },
      },
      {
        onSuccess: (response) => {
          if (response.status === 200) {
            setOpen(false);
            onCreated(response.data.jiraTicketId);
          }
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="default">
          Create JIRA ticket for this group
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create JIRA ticket</DialogTitle>
        </DialogHeader>

        {/* Project / Type / Priority row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Project</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value)}
            >
              <option value="">Select...</option>
              {Array.isArray(projects.data?.data) &&
                projects.data.data.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.key} — {p.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Issue Type</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
            >
              {Array.isArray(issueTypes.data?.data) &&
                issueTypes.data.data.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Priority</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {Array.isArray(priorities.data?.data) &&
                priorities.data.data.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Summary</label>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Description</label>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono min-h-[160px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Attachments preview */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">
            Attachments ({group.comments.length * 2} screenshots)
          </label>
          <div className="space-y-1">
            {group.comments.map((c) => (
              <div key={c.id}>
                {c.screenshotFullPage && (
                  <div className="flex items-center gap-2 px-2 py-1 bg-muted/30 rounded text-xs text-muted-foreground">
                    <span className="text-green-500">&#10003;</span>
                    {c.componentName ?? c.elementName}-full.png
                  </div>
                )}
                {c.screenshotElement && (
                  <div className="flex items-center gap-2 px-2 py-1 bg-muted/30 rounded text-xs text-muted-foreground">
                    <span className="text-green-500">&#10003;</span>
                    {c.componentName ?? c.elementName}-element.png
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!projectKey || createTicket.isPending}>
            {createTicket.isPending ? "Creating..." : "Create ticket"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
