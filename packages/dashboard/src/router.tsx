import { createBrowserRouter } from "react-router";
import DashboardLayout from "./components/layout/dashboard-layout";
import SelectionListPage from "./pages/selections/list";
import SelectionDetailPage from "./pages/selections/detail";
import SettingsPage from "./pages/settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: DashboardLayout,
    children: [
      { index: true, Component: SelectionListPage },
      { path: "selections/:id", Component: SelectionDetailPage },
      { path: "settings", Component: SettingsPage },
    ],
  },
]);
