import type { Locator, Page } from "@playwright/test";

interface OpenSelectionCardOptions {
  /** Also open the card's Jira comments, which start closed. */
  comments?: boolean;
}

/**
 * Opens a selection's card in the sidebar list, which shows each selection
 * as a row whose card opens underneath, and returns the card. The sidebar
 * must already be open.
 */
export const openSelectionCard = async (
  page: Page,
  text?: string | RegExp,
  options: OpenSelectionCardOptions = {},
): Promise<Locator> => {
  const cards = page.locator(
    "[data-react-grab-selection-tree] [data-react-grab-selection-card]",
  );
  const card = (text ? cards.filter({ hasText: text }) : cards).first();
  const row = card.locator("[data-react-grab-selection-row]");
  if ((await row.getAttribute("aria-expanded")) !== "true") await row.click();
  if (options.comments) {
    const trigger = card.locator(
      '[data-react-grab-comments-section] [data-slot="collapsible-card-trigger"]',
    );
    if ((await trigger.getAttribute("aria-expanded")) !== "true") {
      await trigger.click();
    }
  }
  return card;
};
