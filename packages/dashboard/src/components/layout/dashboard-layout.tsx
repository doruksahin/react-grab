import { Outlet } from "react-router";

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-border bg-sidebar p-4">
        <nav className="space-y-2">
          <a href="/" className="block text-sm font-medium">
            Selections
          </a>
          <a href="/settings" className="block text-sm text-muted-foreground">
            Settings
          </a>
        </nav>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
