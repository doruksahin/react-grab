import { expect, type Page } from "@playwright/test";

export const openGroupDetail = async (page: Page, groupName: string) => {
  const card = page.locator("[data-react-grab-group-card]").filter({
    has: page.getByText(groupName, { exact: true }),
  });
  await card.hover();
  await card.getByTitle("Open detail view", { exact: true }).click();
  await expect(
    page.getByRole("region", { name: `Detail: ${groupName}`, exact: true }),
  ).toBeVisible();
};
