import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  open: "text-blue-500 border-blue-500/30 bg-blue-500/10",
  ticketed: "text-yellow-500 border-yellow-500/30 bg-yellow-500/10",
  resolved: "text-green-500 border-green-500/30 bg-green-500/10",
} as const;

type Status = keyof typeof STATUS_STYLES;

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status])}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
