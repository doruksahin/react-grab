import { parse } from "@puppeteer/replay";
import type { Page } from "@playwright/test";
import { test, expect, type ReactGrabPageObject } from "../fixtures.js";
import type { MockServerHandle } from "../mocks/routes.js";

/**
 * ADR-0025: with step capture on, a new comment carries the clicks and field
 * changes that led to it as Chrome DevTools Recorder steps. Input values are
 * never stored, and React Grab's own clicks are not steps.
 */

const NEW_COMMENT = "Submit does nothing";
const TYPED_VALUE = "SECRET-123";

interface SavedComment {
  commentText?: string;
  steps?: unknown[];
}

const isSavedComment = (body: unknown): body is SavedComment =>
  typeof body === "object" && body !== null && !Array.isArray(body);

const savedComments = (
  requests: ReadonlyArray<{ body: unknown }>,
): SavedComment[] =>
  requests
    .map((request) => request.body)
    .filter(isSavedComment)
    .filter((body) => body.commentText === NEW_COMMENT);

const start = async (reactGrab: ReactGrabPageObject, enabled: boolean) => {
  await reactGrab.reinitialize({ steps: { enabled } });
  await reactGrab.triggerInitSync();
  await expect
    .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
    .toBe(true);
};

const useThePage = async (page: Page) => {
  await page.getByTestId("test-input").fill(TYPED_VALUE);
  await page.getByTestId("submit-button").click();
};

const addComment = async (reactGrab: ReactGrabPageObject) => {
  await reactGrab.registerCommentAction();
  await reactGrab.enterPromptMode("li:first-child");
  await reactGrab.typeInInput(NEW_COMMENT);
  await reactGrab.submitInput();
};

const firstSavedComment = async (
  mockServer: MockServerHandle,
): Promise<SavedComment> => {
  await expect
    .poll(() => savedComments(mockServer.requests("upsertComment")).length, {
      timeout: 5000,
    })
    .toBeGreaterThan(0);
  const [saved] = savedComments(mockServer.requests("upsertComment"));
  return saved;
};

test.describe("Reproduce steps", { tag: ["@ADR-0025"] }, () => {
  test("a new comment carries the steps that led to it", async ({
    page,
    reactGrab,
    mockServer,
  }) => {
    await start(reactGrab, true);
    await useThePage(page);
    await addComment(reactGrab);

    const { steps } = await firstSavedComment(mockServer);
    expect(steps?.[0]).toEqual({ type: "navigate", url: page.url() });
    expect(steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "change",
          value: "",
          selectors: expect.arrayContaining([
            'aria/Text Input[role="textbox"]',
            "#test-input",
          ]),
        }),
        expect.objectContaining({
          type: "click",
          selectors: expect.arrayContaining([
            'aria/Submit[role="button"]',
            '[data-testid="submit-button"]',
          ]),
        }),
      ]),
    );
    expect(() => parse({ title: NEW_COMMENT, steps })).not.toThrow();
  });

  test("typed values are never stored", async ({
    page,
    reactGrab,
    mockServer,
  }) => {
    await start(reactGrab, true);
    await useThePage(page);
    await addComment(reactGrab);

    const saved = await firstSavedComment(mockServer);
    expect(JSON.stringify(saved)).not.toContain(TYPED_VALUE);
  });

  test("a click that selects an element is not a step", async ({
    page,
    reactGrab,
    mockServer,
  }) => {
    await start(reactGrab, true);
    await useThePage(page);
    await reactGrab.activate();
    await page.locator("li").first().click();
    await reactGrab.deactivate();
    await addComment(reactGrab);

    const { steps } = await firstSavedComment(mockServer);
    expect(steps?.at(-1)).toMatchObject({
      type: "click",
      selectors: expect.arrayContaining(['[data-testid="submit-button"]']),
    });
  });

  test("without the option, no steps are saved", async ({
    page,
    reactGrab,
    mockServer,
  }) => {
    await start(reactGrab, false);
    await useThePage(page);
    await addComment(reactGrab);

    const saved = await firstSavedComment(mockServer);
    expect(saved.steps).toBeUndefined();
  });
});
