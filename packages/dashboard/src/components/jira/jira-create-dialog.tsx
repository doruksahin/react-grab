import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

function generateDescription(
  group: GroupWithComments,
  screenshotCount: number,
): string {
  let desc = `## Group: ${group.name}\n\n`;
  group.comments.forEach((c, i) => {
    desc += `### ${i + 1}. ${c.componentName ?? c.elementName} <${c.tagName}>\n`;
    if (c.commentText) desc += `${c.commentText}\n`;
    if (c.elementSelectors?.[0])
      desc += `Selector: \`${c.elementSelectors[0]}\`\n`;
    desc += "\n";
  });
  desc += `## Evidence\nSee attached screenshots (${screenshotCount} images).\n\n_Created by react-grab dashboard_`;
  return desc;
}

function generateSummary(group: GroupWithComments): string {
  const components = group.comments.map(
    (c) => c.componentName ?? c.elementName,
  );
  const unique = [...new Set(components)];
  return `${group.name} — ${unique.join(", ")}`;
}

export function JiraCreateDialog({ group, onCreated }: JiraCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [projectKey, setProjectKey] = useState("");
  const [issueType, setIssueType] = useState("Bug");
  const [priority, setPriority] = useState("Medium");
  const [summary, setSummary] = useState(generateSummary(group));
  const screenshotCount =
    group.comments.filter((c) => c.screenshotFullPage).length +
    group.comments.filter((c) => c.screenshotElement).length;
  const [description, setDescription] = useState(
    generateDescription(group, screenshotCount),
  );

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

  const projectItems = Array.isArray(projects.data?.data)
    ? projects.data.data
    : [];
  const issueTypeItems = Array.isArray(issueTypes.data?.data)
    ? issueTypes.data.data
    : [];
  const priorityItems = Array.isArray(priorities.data?.data)
    ? priorities.data.data
    : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">Create JIRA ticket for this group</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create JIRA ticket</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project / Type / Priority */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectKey} onValueChange={setProjectKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project..." />
                </SelectTrigger>
                <SelectContent>
                  {projectItems.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.key} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Issue Type</Label>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {issueTypeItems.map((t) => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityItems.map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <Label>Summary</Label>
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              className="font-mono text-xs min-h-[160px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <Label>Attachments ({screenshotCount} screenshots)</Label>
            <div className="space-y-1">
              {group.comments.map((c) => (
                <div key={c.id} className="space-y-1">
                  {c.screenshotFullPage && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 rounded-md text-xs text-muted-foreground">
                      <span className="text-green-500 text-sm">&#10003;</span>
                      {c.componentName ?? c.elementName}-full.png
                    </div>
                  )}
                  {c.screenshotElement && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 rounded-md text-xs text-muted-foreground">
                      <span className="text-green-500 text-sm">&#10003;</span>
                      {c.componentName ?? c.elementName}-element.png
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          {createTicket.isError && (
            <p className="text-xs text-destructive mr-auto self-center">
              Failed to create ticket. Please try again.
            </p>
          )}
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!projectKey || createTicket.isPending}
          >
            {createTicket.isPending ? "Creating..." : "Create ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
