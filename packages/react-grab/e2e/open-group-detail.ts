import { expect, type Page } from "@playwright/test";

export const openGroupDetail = async (page: Page, groupName: string) => {
  const section = page
    .locator("[data-react-grab-sidebar] [data-react-grab-group-collapsible]")
    .filter({ has: page.getByText(groupName, { exact: true }) })
    .first();
  await section
    .locator("[data-react-grab-group-ticket-summary]")
    .getByRole("button", { name: "Open detail view", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: `Detail: ${groupName}`, exact: true }),
  ).toBeVisible();
};
