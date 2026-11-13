import { test, expect, type ReactGrabPageObject } from "../fixtures.js";
import type { Page } from "@playwright/test";

/**
 * Scenarios S5.3, S5.4 and S5.5 (docs/scenarios/journey/scenarios.md, Plane
 * RG-2). Designs: Penpot page "08 · Gaps — proposals", boards G2.1–G2.4.
 *
 * Covers the submit path of the Jira create dialog: required fields block
 * submit, a failed request keeps the form and offers Retry, and a successful
 * request confirms the ticket instead of closing silently.
 *
 * Runs against the mocked sync server. No real Jira is ever contacted.
 */

const COMMENT_TEXT = "Price label overlaps the badge";
const TICKET_ID = "ATT-103";
const TICKET_URL = "https://adcreative.atlassian.net/browse/ATT-103";

const openCreateDialog = async (page: Page, reactGrab: ReactGrabPageObject) => {
  await reactGrab.registerCommentAction();
  await reactGrab.enterPromptMode("li:first-child");
  await reactGrab.typeInInput(COMMENT_TEXT);
  await reactGrab.submitInput();

  await page.locator("[data-react-grab-toolbar-dashboard]").click();
  await page
    .getByRole("dialog", { name: "React Grab Dashboard" })
    .getByRole("button", { name: /^Selections/ })
    .click();
  await page
    .locator("[data-react-grab-selection-card]")
    .filter({ hasText: COMMENT_TEXT })
    .locator("[data-react-grab-create-ticket]")
    .click();

  const form = page.locator("[data-react-grab-jira-form]");
  await expect(form).toBeVisible({ timeout: 5000 });
  return form;
};

/**
 * Fails the next create-ticket POST only. Registered last so it takes
 * precedence over the mock server, and `times: 1` retires it afterwards so a
 * retry reaches the mock server's own handler.
 */
const failNextCreate = async (page: Page) => {
  await page.route(
    "**/workspaces/*/groups/*/jira-ticket",
    (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "JIRA rejected the request" }),
      }),
    { times: 1 },
  );
};

test.describe(
  "Jira create dialog — validation, retry and success",
  { tag: ["@SPEC-003", "@S5.3", "@S5.4", "@S5.5"] },
  () => {
    test.beforeEach(async ({ reactGrab, mockServer: _mockServer }) => {
      await reactGrab.triggerInitSync();
      await expect
        .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
        .toBe(true);
    });

    test(
      "AC-1: an empty summary blocks submit and marks the field",
      { annotation: { type: "ac", description: "S5.3 AC-1" } },
      async ({ page, reactGrab }) => {
        const form = await openCreateDialog(page, reactGrab);
        const submit = form.getByRole("button", { name: "Create Ticket" });
        const summary = form.locator("textarea").first();

        await expect(submit).toBeEnabled({ timeout: 5000 });
        await expect(
          form.locator("[data-react-grab-jira-required]"),
        ).toHaveCount(0);

        await summary.fill("");
        await expect(submit).toBeDisabled();
        await expect(
          form.locator("[data-react-grab-jira-required]"),
        ).toHaveCount(1);

        await summary.fill("Price label overlaps");
        await expect(submit).toBeEnabled();
        await expect(
          form.locator("[data-react-grab-jira-required]"),
        ).toHaveCount(0);
      },
    );

    test(
      "AC-2: whitespace alone does not count as a summary",
      { annotation: { type: "ac", description: "S5.3 AC-2" } },
      async ({ page, reactGrab }) => {
        const form = await openCreateDialog(page, reactGrab);
        await form.locator("textarea").first().fill("   ");
        await expect(
          form.getByRole("button", { name: "Create Ticket" }),
        ).toBeDisabled();
      },
    );

    test(
      "AC-3: a failed submit keeps the form and offers Retry",
      { annotation: { type: "ac", description: "S5.4 AC-1" } },
      async ({ page, reactGrab }) => {
        const form = await openCreateDialog(page, reactGrab);
        const summary = form.locator("textarea").first();
        await summary.fill("Price label overlaps the badge");

        await failNextCreate(page);
        await form.getByRole("button", { name: "Create Ticket" }).click();

        const banner = form.locator("[data-react-grab-jira-error]");
        await expect(banner).toBeVisible({ timeout: 5000 });
        await expect(banner).toContainText(
          "Could not create the ticket. Your form is kept.",
        );
        await expect(summary).toHaveValue("Price label overlaps the badge");
        await expect(form.getByRole("button", { name: "Retry" })).toBeEnabled();
        await reactGrab.screenshot("jira-create-failed", "page");
      },
    );

    test(
      "AC-4: Retry after a failure creates the ticket",
      { annotation: { type: "ac", description: "S5.4 AC-2" } },
      async ({ page, reactGrab, mockServer }) => {
        const form = await openCreateDialog(page, reactGrab);
        await failNextCreate(page);
        await form.getByRole("button", { name: "Create Ticket" }).click();

        const retry = form.getByRole("button", { name: "Retry" });
        await expect(retry).toBeEnabled({ timeout: 5000 });

        await retry.click();

        await expect(
          form.locator("[data-react-grab-jira-success]"),
        ).toBeVisible({ timeout: 5000 });
        await expect(form.locator("[data-react-grab-jira-error]")).toHaveCount(
          0,
        );
        expect(mockServer.requests("createJiraTicket").length).toBeGreaterThan(
          0,
        );
      },
    );

    test(
      "AC-5: a successful submit confirms the ticket and stays open",
      { annotation: { type: "ac", description: "S5.5 AC-1" } },
      async ({ page, reactGrab }) => {
        const form = await openCreateDialog(page, reactGrab);
        await form.getByRole("button", { name: "Create Ticket" }).click();

        const success = form.locator("[data-react-grab-jira-success]");
        await expect(success).toBeVisible({ timeout: 5000 });
        await expect(success).toContainText(`locked to ${TICKET_ID}`);
        await expect(form).toContainText(`${TICKET_ID} created`);

        const link = form.getByRole("link", { name: /Open in Jira/ });
        await expect(link).toHaveAttribute("href", TICKET_URL);
        await reactGrab.screenshot("jira-create-success", "page");

        await form.getByRole("button", { name: "Done" }).click();
        await expect(form).toHaveCount(0);
      },
    );
  },
);
