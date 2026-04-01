import { useMemo, useRef, useState } from "react";
import { Popover } from "radix-ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { cn } from "@/lib/utils";
import {
  useListJiraProjects,
  useListJiraIssueTypes,
  useListJiraPriorities,
  useCreateJiraTicket,
} from "@/api/endpoints/jira/jira";
import { WORKSPACE_ID } from "@/lib/config";
import type { GroupWithComments } from "@/lib/types";
import { HugeiconsIcon } from "@hugeicons/react";
import { UnfoldMoreIcon } from "@hugeicons/core-free-icons";

interface JiraCreateDialogProps {
  group: GroupWithComments;
  onCreated: (ticketId: string) => void;
}

interface ComboSelectItem {
  value: string;
  label: string;
}

interface ComboSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  items: ComboSelectItem[];
  placeholder?: string;
}

/** Searchable dropdown — only renders filtered items, so large lists open instantly. */
function ComboSelect({
  value,
  onValueChange,
  items,
  placeholder = "Select...",
}: ComboSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q === "" ? items : items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, search]);

  const selectedLabel = items.find((i) => i.value === value)?.label;

  function handleSelect(val: string) {
    onValueChange(val);
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover.Root
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setTimeout(() => inputRef.current?.focus(), 0);
        else setSearch("");
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-7 w-full items-center justify-between gap-1.5 rounded-md border border-input bg-input/20 px-2 py-1.5 text-xs/relaxed whitespace-nowrap transition-colors outline-none",
            "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
            "dark:bg-input/30 dark:hover:bg-input/50",
            !selectedLabel && "text-muted-foreground",
          )}
        >
          <span className="truncate">{selectedLabel ?? placeholder}</span>
          <HugeiconsIcon
            icon={UnfoldMoreIcon}
            strokeWidth={2}
            className="shrink-0 size-3.5 text-muted-foreground"
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          className={cn(
            "z-50 w-[var(--radix-popover-trigger-width)] min-w-48 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          {/* Search input */}
          <div className="p-1.5 border-b border-border/50">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-md bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Filtered list — only matched items are rendered */}
          <div className="overflow-y-auto max-h-56 p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No results
              </p>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleSelect(item.value)}
                  className={cn(
                    "flex w-full items-center rounded-md px-2 py-1 text-xs/relaxed text-left cursor-default select-none",
                    "hover:bg-accent hover:text-accent-foreground",
                    item.value === value && "bg-accent/60 font-medium",
                  )}
                >
                  {item.label}
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
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

  const projectItems: ComboSelectItem[] = Array.isArray(projects.data?.data)
    ? projects.data.data.map((p) => ({
        value: p.key,
        label: `${p.key} — ${p.name}`,
      }))
    : [];

  const issueTypeItems: ComboSelectItem[] = Array.isArray(issueTypes.data?.data)
    ? [...new Map(issueTypes.data.data.map((t) => [t.name, t])).values()].map(
        (t) => ({ value: t.name, label: t.name }),
      )
    : [];

  const priorityItems = Array.isArray(priorities.data?.data)
    ? [...new Map(priorities.data.data.map((p) => [p.name, p])).values()]
    : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">Create JIRA ticket for this group</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create JIRA ticket</DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new ticket in JIRA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project — searchable combobox, opens instantly regardless of list size */}
          <div className="space-y-2">
            <Label>Project</Label>
            <ComboSelect
              value={projectKey}
              onValueChange={setProjectKey}
              items={projectItems}
              placeholder="Select project..."
            />
          </div>

          {/* Issue Type (searchable) / Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Issue Type</Label>
              <ComboSelect
                value={issueType}
                onValueChange={setIssueType}
                items={issueTypeItems}
                placeholder="Select type..."
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-full">
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
