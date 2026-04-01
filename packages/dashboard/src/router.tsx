import { createBrowserRouter } from "react-router";
import DashboardLayout from "./components/layout/dashboard-layout";
import GroupListPage from "./pages/groups/list";
import GroupDetailPage from "./pages/groups/detail";
import SettingsPage from "./pages/settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: DashboardLayout,
    children: [
      { index: true, Component: GroupListPage },
      { path: "groups/:groupId", Component: GroupDetailPage },
      { path: "settings", Component: SettingsPage },
    ],
  },
]);
