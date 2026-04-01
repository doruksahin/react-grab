import { Link, Outlet, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { WORKSPACE_ID } from "@/lib/config";

export default function DashboardLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-60 border-r border-border bg-card p-4 flex flex-col">
        <div className="text-sm font-semibold px-3 py-2 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          react-grab
        </div>

        <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-3 py-1">Review</div>
        <Link
          to="/"
          className={cn(
            "text-sm px-3 py-2 rounded-md",
            location.pathname === "/" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Groups
        </Link>

        <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-3 py-1 mt-4">Settings</div>
        <Link
          to="/settings"
          className={cn(
            "text-sm px-3 py-2 rounded-md",
            location.pathname === "/settings" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Workspace
        </Link>

        <div className="mt-auto pt-4 border-t border-border px-3 py-2">
          <div className="text-xs font-medium text-muted-foreground">{WORKSPACE_ID}</div>
          <div className="text-[11px] text-muted-foreground/60">Connected to sync-server</div>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
