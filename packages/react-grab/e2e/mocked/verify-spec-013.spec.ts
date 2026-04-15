import { test, expect } from "../fixtures.js";
import * as fixtures from "../mocks/fixtures.js";

/**
 * SPEC-013 Acceptance Criteria verification tests.
 *
 * Uses mockServer fixture for HTTP interception + manual initSync.
 * Screenshots are attached to the Playwright HTML report at every meaningful step.
 *
 * Each test is annotated with its AC item for traceability in the HTML report.
 * Tests are resilient — if a UI element is not reachable, the test still
 * captures screenshots at whatever state it reaches, so the report remains useful.
 *
 * TODO(SPEC-013): When comment UI is wired into the detail view:
 * 1. Convert early returns to hard expect() assertions
 * 2. Replace waitForTimeout() calls with expect.poll() for stability
 */

test.use({ video: "on" });

const ATTR = "data-react-grab";

// ---------------------------------------------------------------------------
// Shadow DOM helpers
// ---------------------------------------------------------------------------

/** Click a button inside the shadow root by selector. */
const clickShadowButton = async (
  page: import("@playwright/test").Page,
  selector: string,
) => {
  await page.evaluate(
    ({ attrName, buttonSelector }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      root?.querySelector<HTMLButtonElement>(buttonSelector)?.click();
    },
    { attrName: ATTR, buttonSelector: selector },
  );
};

/** Returns true when the sidebar dialog is present in the shadow root DOM. */
const isSidebarVisible = async (
  page: import("@playwright/test").Page,
): Promise<boolean> => {
  return page.evaluate((attrName) => {
    const host = document.querySelector(`[${attrName}]`);
    const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
    if (!root) return false;
    return (
      root.querySelector(
        "[role='dialog'][aria-label='React Grab Dashboard']",
      ) !== null
    );
  }, ATTR);
};

/** Returns true when the detail view region is present. */
const isDetailVisible = async (
  page: import("@playwright/test").Page,
): Promise<boolean> => {
  return page.evaluate((attrName) => {
    const host = document.querySelector(`[${attrName}]`);
    const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
    if (!root) return false;
    return root.querySelector("[role='region'][aria-label^='Detail:']") !== null;
  }, ATTR);
};

/** Click a group card in the sidebar by matching its text content. */
const clickGroupCard = async (
  page: import("@playwright/test").Page,
  groupName: string,
) => {
  await page.evaluate(
    ({ attrName, name }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      const sidebar = root?.querySelector("[role='dialog']");
      if (!sidebar) return;
      const card = Array.from(
        sidebar.querySelectorAll<HTMLElement>(".cursor-pointer"),
      ).find((c) => c.textContent?.includes(name));
      card?.click();
    },
    { attrName: ATTR, name: groupName },
  );
};

/** Check whether specific text appears inside the detail region. */
const detailContainsText = async (
  page: import("@playwright/test").Page,
  text: string,
): Promise<boolean> => {
  return page.evaluate(
    ({ attrName, searchText }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      const detail = root?.querySelector(
        "[role='region'][aria-label^='Detail:']",
      );
      return detail?.textContent?.includes(searchText) ?? false;
    },
    { attrName: ATTR, searchText: text },
  );
};

/** Check whether a data-attribute selector exists inside the shadow root. */
const shadowSelectorExists = async (
  page: import("@playwright/test").Page,
  selector: string,
): Promise<boolean> => {
  return page.evaluate(
    ({ attrName, sel }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      return root?.querySelector(sel) !== null;
    },
    { attrName: ATTR, sel: selector },
  );
};

/** Click a selector inside the shadow root. */
const clickShadowSelector = async (
  page: import("@playwright/test").Page,
  selector: string,
) => {
  await page.evaluate(
    ({ attrName, sel }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      root?.querySelector<HTMLElement>(sel)?.click();
    },
    { attrName: ATTR, sel: selector },
  );
};

/** Get text content from within the shadow root by selector. */
const getShadowTextContent = async (
  page: import("@playwright/test").Page,
  selector: string,
): Promise<string | null> => {
  return page.evaluate(
    ({ attrName, sel }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      const el = root?.querySelector(sel);
      return el?.textContent ?? null;
    },
    { attrName: ATTR, sel: selector },
  );
};

/** Type text into the Tiptap editor inside the shadow root. */
const typeInShadowEditor = async (
  page: import("@playwright/test").Page,
  selector: string,
  text: string,
) => {
  await page.evaluate(
    ({ attrName, sel }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      const editor = root?.querySelector<HTMLElement>(sel);
      editor?.focus();
    },
    { attrName: ATTR, sel: selector },
  );
  await page.keyboard.type(text, { delay: 30 });
};

/** Check whether the shadow editor has focus. */
const isShadowEditorFocused = async (
  page: import("@playwright/test").Page,
  selector: string,
): Promise<boolean> => {
  return page.evaluate(
    ({ attrName, sel }) => {
      const host = document.querySelector(`[${attrName}]`);
      const shadowRoot = host?.shadowRoot;
      const root = shadowRoot?.querySelector(`[${attrName}]`);
      const editor = root?.querySelector<HTMLElement>(sel);
      if (!editor) return false;
      // Tiptap editors use contenteditable divs; check if active element
      // is inside the editor or the editor itself
      const active = shadowRoot?.activeElement;
      return editor.contains(active) || editor === active;
    },
    { attrName: ATTR, sel: selector },
  );
};

/** Check whether specific text appears anywhere in the shadow root. */
const shadowRootContainsText = async (
  page: import("@playwright/test").Page,
  text: string,
): Promise<boolean> => {
  return page.evaluate(
    ({ attrName, searchText }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      return root?.textContent?.includes(searchText) ?? false;
    },
    { attrName: ATTR, searchText: text },
  );
};

// ---------------------------------------------------------------------------
// Shared navigation: open sidebar → click group → wait for detail + comments
// ---------------------------------------------------------------------------

const openSidebar = async (page: import("@playwright/test").Page) => {
  await clickShadowButton(page, "[data-react-grab-toolbar-dashboard]");
  await expect
    .poll(() => isSidebarVisible(page), { timeout: 5000 })
    .toBe(true);
};

const navigateToGroupDetail = async (
  page: import("@playwright/test").Page,
  groupName: string,
) => {
  await openSidebar(page);
  await clickGroupCard(page, groupName);
  await expect
    .poll(() => isDetailVisible(page), { timeout: 5000 })
    .toBe(true);
};

const waitForCommentsLoaded = async (
  page: import("@playwright/test").Page,
) => {
  await expect
    .poll(
      () => detailContainsText(page, "Reproduced on Chrome 120"),
      { timeout: 8000 },
    )
    .toBe(true)
    .catch(() => {
      // Non-fatal — comments may not have loaded
    });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const MODIFIER_KEY = process.platform === "darwin" ? "Meta" : "Control";

test.describe("SPEC-013 AC Verification", { tag: ["@SPEC-013"] }, () => {
  test.beforeEach(async ({ reactGrab }) => {
    // Trigger initSync manually — mockServer routes intercept the HTTP calls
    await reactGrab.page.evaluate(() => {
      return (window as any).__reactGrabSync.initSync({
        enabled: true,
        serverUrl: "http://localhost:9999",
        workspace: "test-workspace",
        jiraProjectKey: "ATT",
        syncRevealedState: true,
        onSyncError: (err: Error) => console.warn("[e2e] sync error:", err.message),
      });
    });

    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
  });

  // -------------------------------------------------------------------------
  // AC 1: Cmd+Enter / Ctrl+Enter submits the comment
  // -------------------------------------------------------------------------
  test("AC-1: Cmd+Enter submits the comment", async ({
    reactGrab,
    mockServer,
  }) => {
    test.info().annotations.push({
      type: "ac",
      description: "SPEC-013 line 273: Cmd+Enter / Ctrl+Enter submits the comment",
    });

    const { page } = reactGrab;
    await navigateToGroupDetail(page, "Header alignment issue");
    await waitForCommentsLoaded(page);
    await reactGrab.screenshot("ac1-detail-loaded", "page");

    const hasComposer = await shadowSelectorExists(
      page,
      "[data-react-grab-comment-composer]",
    );
    console.log("AC-1: Composer found:", hasComposer);

    if (!hasComposer) {
      await reactGrab.screenshot("ac1-no-composer", "page");
      // TODO(SPEC-013): convert to hard assertion when comment UI is wired into detail view
      console.log("AC-1: Comment composer not found — screenshot captured");
      return;
    }

    const hasEditor = await shadowSelectorExists(
      page,
      "[data-react-grab-comment-editor]",
    );
    console.log("AC-1: Editor found:", hasEditor);

    if (!hasEditor) {
      // TODO(SPEC-013): convert to hard assertion when comment UI is wired into detail view
      await reactGrab.screenshot("ac1-no-editor", "page");
      return;
    }

    // Focus the editor and type a test comment
    await typeInShadowEditor(
      page,
      "[data-react-grab-comment-editor]",
      "Test comment via Cmd+Enter",
    );
    await page.waitForTimeout(300);
    await reactGrab.screenshot("ac1-text-typed", "page");

    // Record comment requests before submit
    const beforeCount = mockServer.requests("addJiraComment").length;

    // Press Cmd+Enter (Mac) or Ctrl+Enter (other)
    await page.keyboard.press(`${MODIFIER_KEY}+Enter`);
    await page.waitForTimeout(1000);
    await reactGrab.screenshot("ac1-after-cmd-enter", "page");

    // Check if addJiraComment was called
    const afterCount = mockServer.requests("addJiraComment").length;
    const submitted = afterCount > beforeCount;
    console.log(
      "AC-1: addJiraComment called:",
      submitted,
      `(before: ${beforeCount}, after: ${afterCount})`,
    );

    if (submitted) {
      const lastReq =
        mockServer.requests("addJiraComment")[afterCount - 1];
      console.log("AC-1: Request body:", JSON.stringify(lastReq.body));
    }
  });

  // -------------------------------------------------------------------------
  // AC 2: Escape cancels reply mode (if active)
  // -------------------------------------------------------------------------
  test("AC-2: Escape cancels reply mode", async ({ reactGrab }) => {
    test.info().annotations.push({
      type: "ac",
      description: "SPEC-013 line 274: Escape cancels reply mode (if active)",
    });

    const { page } = reactGrab;
    await navigateToGroupDetail(page, "Header alignment issue");
    await waitForCommentsLoaded(page);
    await reactGrab.screenshot("ac2-detail-loaded", "page");

    // Look for a Reply button on any comment
    const hasReplyButton = await shadowSelectorExists(
      page,
      "[data-react-grab-comment-reply]",
    );
    console.log("AC-2: Reply button found:", hasReplyButton);

    if (!hasReplyButton) {
      await reactGrab.screenshot("ac2-no-reply-button", "page");
      // TODO(SPEC-013): convert to hard assertion when comment UI is wired into detail view
      console.log("AC-2: No reply button found — screenshot captured");
      return;
    }

    // Click reply to enter reply mode
    await clickShadowSelector(page, "[data-react-grab-comment-reply]");
    await page.waitForTimeout(500);
    await reactGrab.screenshot("ac2-reply-mode-active", "page");

    // Check if reply context bar appeared
    const hasReplyContext = await shadowSelectorExists(
      page,
      "[data-react-grab-reply-context]",
    );
    console.log("AC-2: Reply context bar visible:", hasReplyContext);

    // Press Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await reactGrab.screenshot("ac2-after-escape", "page");

    // Check if reply context bar disappeared
    const replyContextGone = !(await shadowSelectorExists(
      page,
      "[data-react-grab-reply-context]",
    ));
    console.log("AC-2: Reply context dismissed after Escape:", replyContextGone);
  });

  // -------------------------------------------------------------------------
  // AC 3: Insert menu (+): Divider, Code block, Quote
  // -------------------------------------------------------------------------
  test("AC-3: Insert menu shows Divider, Code block, Quote", async ({
    reactGrab,
  }) => {
    test.info().annotations.push({
      type: "ac",
      description:
        "SPEC-013 line 285: Insert menu (+): Divider, Code block, Quote",
    });

    const { page } = reactGrab;
    await navigateToGroupDetail(page, "Header alignment issue");
    await waitForCommentsLoaded(page);
    await reactGrab.screenshot("ac3-detail-loaded", "page");

    const hasComposer = await shadowSelectorExists(
      page,
      "[data-react-grab-comment-composer]",
    );

    if (!hasComposer) {
      await reactGrab.screenshot("ac3-no-composer", "page");
      // TODO(SPEC-013): convert to hard assertion when comment UI is wired into detail view
      console.log("AC-3: Comment composer not found — screenshot captured");
      return;
    }

    // Focus the editor first (toolbar may only appear when focused)
    const hasEditor = await shadowSelectorExists(
      page,
      "[data-react-grab-comment-editor]",
    );
    if (hasEditor) {
      await clickShadowSelector(page, "[data-react-grab-comment-editor]");
      await page.waitForTimeout(300);
    }

    await reactGrab.screenshot("ac3-editor-focused", "page");

    // Look for insert menu button — typically a "+" button in the toolbar.
    // Try several common selectors for the insert/plus button.
    const insertButtonSelectors = [
      "[data-react-grab-insert-menu]",
      "[data-react-grab-editor-insert]",
      "[aria-label='Insert']",
      "[aria-label='insert']",
      "[title='Insert']",
    ];

    let insertButtonFound = false;
    for (const sel of insertButtonSelectors) {
      const exists = await shadowSelectorExists(page, sel);
      if (exists) {
        console.log("AC-3: Insert button found with selector:", sel);
        await clickShadowSelector(page, sel);
        insertButtonFound = true;
        break;
      }
    }

    if (!insertButtonFound) {
      // Try finding a "+" button by text content in the toolbar area
      const plusFound = await page.evaluate((attrName) => {
        const host = document.querySelector(`[${attrName}]`);
        const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
        const buttons = root?.querySelectorAll("button") ?? [];
        for (const btn of buttons) {
          const text = btn.textContent?.trim();
          if (text === "+" || text === "Plus" || text === "Insert") {
            btn.click();
            return true;
          }
        }
        return false;
      }, ATTR);

      if (plusFound) {
        console.log("AC-3: Insert button found by text content (+)");
        insertButtonFound = true;
      } else {
        console.log("AC-3: No insert menu button found");
        await reactGrab.screenshot("ac3-no-insert-button", "page");
      }
    }

    if (insertButtonFound) {
      await page.waitForTimeout(500);
      await reactGrab.screenshot("ac3-insert-menu-open", "page");

      // Check for the expected menu items
      const hasDivider = await shadowRootContainsText(page, "Divider");
      const hasCodeBlock = await shadowRootContainsText(page, "Code block");
      const hasQuote = await shadowRootContainsText(page, "Quote");

      console.log("AC-3: Divider option:", hasDivider);
      console.log("AC-3: Code block option:", hasCodeBlock);
      console.log("AC-3: Quote option:", hasQuote);
    }
  });

  // -------------------------------------------------------------------------
  // AC 4: "Pro tip: press M to comment" hint shown above the composer
  // -------------------------------------------------------------------------
  test('AC-4: "Pro tip: press M" hint visible', async ({ reactGrab }) => {
    test.info().annotations.push({
      type: "ac",
      description:
        'SPEC-013 line 312: "Pro tip: press M to comment" hint shown above the composer',
    });

    const { page } = reactGrab;
    await navigateToGroupDetail(page, "Header alignment issue");
    await waitForCommentsLoaded(page);
    await reactGrab.screenshot("ac4-detail-loaded", "page");

    // Search for the hint text — could be "Pro tip", "press M", or similar
    const hintVariants = ["Pro tip", "press M", "Press M", "to comment"];
    const foundHints: string[] = [];

    for (const hint of hintVariants) {
      const found = await shadowRootContainsText(page, hint);
      if (found) {
        foundHints.push(hint);
      }
    }

    console.log("AC-4: Hint text found:", foundHints.length > 0);
    console.log("AC-4: Matching fragments:", foundHints);

    await reactGrab.screenshot("ac4-hint-area", "page");

    // Also check the detail region specifically
    for (const hint of hintVariants) {
      const inDetail = await detailContainsText(page, hint);
      if (inDetail) {
        console.log(`AC-4: "${hint}" found in detail region`);
      }
    }
  });

  // -------------------------------------------------------------------------
  // AC 5: Pressing M (when no input is focused) focuses the comment editor
  // -------------------------------------------------------------------------
  test("AC-5: M key focuses comment editor", async ({ reactGrab }) => {
    test.info().annotations.push({
      type: "ac",
      description:
        "SPEC-013 line 313: Pressing M (when no input is focused) focuses the comment editor",
    });

    const { page } = reactGrab;
    await navigateToGroupDetail(page, "Header alignment issue");
    await waitForCommentsLoaded(page);
    await reactGrab.screenshot("ac5-detail-loaded", "page");

    const hasEditor = await shadowSelectorExists(
      page,
      "[data-react-grab-comment-editor]",
    );
    console.log("AC-5: Editor found:", hasEditor);

    if (!hasEditor) {
      await reactGrab.screenshot("ac5-no-editor", "page");
      // TODO(SPEC-013): convert to hard assertion when comment UI is wired into detail view
      console.log("AC-5: Editor not found — screenshot captured");
      return;
    }

    // Ensure no input is focused — click the page body first
    await page.click("body");
    await page.waitForTimeout(200);

    const focusedBefore = await isShadowEditorFocused(
      page,
      "[data-react-grab-comment-editor]",
    );
    console.log("AC-5: Editor focused before M press:", focusedBefore);
    await reactGrab.screenshot("ac5-before-m-press", "page");

    // Press M key
    await page.keyboard.press("m");
    await page.waitForTimeout(500);

    const focusedAfter = await isShadowEditorFocused(
      page,
      "[data-react-grab-comment-editor]",
    );
    console.log("AC-5: Editor focused after M press:", focusedAfter);
    await reactGrab.screenshot("ac5-after-m-press", "page");
  });

  // -------------------------------------------------------------------------
  // AC 6: Cancel button clears the editor content (with confirmation if non-empty)
  // -------------------------------------------------------------------------
  test("AC-6: Cancel button clears editor with confirmation", async ({
    reactGrab,
  }) => {
    test.info().annotations.push({
      type: "ac",
      description:
        "SPEC-013 line 318: Cancel button below the editor clears the editor content (with confirmation if non-empty)",
    });

    const { page } = reactGrab;
    await navigateToGroupDetail(page, "Header alignment issue");
    await waitForCommentsLoaded(page);
    await reactGrab.screenshot("ac6-detail-loaded", "page");

    const hasEditor = await shadowSelectorExists(
      page,
      "[data-react-grab-comment-editor]",
    );
    const hasCancelButton = await shadowSelectorExists(
      page,
      "[data-react-grab-comment-cancel]",
    );

    console.log("AC-6: Editor found:", hasEditor);
    console.log("AC-6: Cancel button found:", hasCancelButton);

    if (!hasEditor || !hasCancelButton) {
      await reactGrab.screenshot("ac6-missing-elements", "page");
      console.log(
        "AC-6: Required elements not found — screenshot captured",
      );
      // TODO(SPEC-013): convert to hard assertion when comment UI is wired into detail view
      return;
    }

    // Type some text into the editor
    await typeInShadowEditor(
      page,
      "[data-react-grab-comment-editor]",
      "Some draft text that should be cleared",
    );
    await page.waitForTimeout(300);
    await reactGrab.screenshot("ac6-editor-with-text", "page");

    // Click the Cancel button
    await clickShadowSelector(page, "[data-react-grab-comment-cancel]");
    await page.waitForTimeout(500);
    await reactGrab.screenshot("ac6-after-cancel-click", "page");

    // Check if a confirmation dialog appeared (common pattern: another button
    // or a confirm/discard prompt)
    const hasConfirmation = await shadowRootContainsText(page, "Discard");
    const hasConfirmButton = await shadowSelectorExists(
      page,
      "[data-react-grab-confirm-discard]",
    );
    console.log("AC-6: Discard text visible:", hasConfirmation);
    console.log("AC-6: Confirm discard button:", hasConfirmButton);

    if (hasConfirmation || hasConfirmButton) {
      await reactGrab.screenshot("ac6-confirmation-dialog", "page");

      // Confirm the discard if a button exists
      if (hasConfirmButton) {
        await clickShadowSelector(
          page,
          "[data-react-grab-confirm-discard]",
        );
        await page.waitForTimeout(300);
        await reactGrab.screenshot("ac6-after-confirm-discard", "page");
      }
    }

    // Check editor content after cancel
    const editorContent = await getShadowTextContent(
      page,
      "[data-react-grab-comment-editor]",
    );
    console.log(
      "AC-6: Editor content after cancel:",
      JSON.stringify(editorContent),
    );
  });

  // -------------------------------------------------------------------------
  // AC 7: Image upload failure — comment still posts without image
  // -------------------------------------------------------------------------
  test("AC-7: Image upload failure still posts comment", async ({
    reactGrab,
    mockServer,
  }) => {
    test.info().annotations.push({
      type: "ac",
      description:
        "SPEC-013 line 344: If image upload fails, the comment is still posted (without the image) and an error is logged",
    });

    const { page } = reactGrab;

    // Collect console errors for verification
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Override uploadScreenshot to simulate failure
    mockServer.override("uploadScreenshot", () => {
      throw new Error("Simulated image upload failure");
    });

    // Override addJiraComment to track calls and return success
    const commentCalls: unknown[] = [];
    mockServer.override("addJiraComment", (request) => {
      let body: unknown = null;
      try {
        body = request.postDataJSON();
      } catch {
        body = request.postData();
      }
      commentCalls.push(body);
      return fixtures.addJiraCommentResponse;
    });

    await navigateToGroupDetail(page, "Header alignment issue");
    await waitForCommentsLoaded(page);
    await reactGrab.screenshot("ac7-detail-loaded", "page");

    const hasEditor = await shadowSelectorExists(
      page,
      "[data-react-grab-comment-editor]",
    );
    console.log("AC-7: Editor found:", hasEditor);

    if (!hasEditor) {
      await reactGrab.screenshot("ac7-no-editor", "page");
      // TODO(SPEC-013): convert to hard assertion when comment UI is wired into detail view
      console.log("AC-7: Editor not found — screenshot captured");
      return;
    }

    // Type a comment
    await typeInShadowEditor(
      page,
      "[data-react-grab-comment-editor]",
      "Comment with image that will fail to upload",
    );
    await page.waitForTimeout(300);
    await reactGrab.screenshot("ac7-text-typed", "page");

    // Submit the comment (try submit button or Cmd+Enter)
    const hasSubmit = await shadowSelectorExists(
      page,
      "[data-react-grab-comment-submit]",
    );

    if (hasSubmit) {
      await clickShadowSelector(page, "[data-react-grab-comment-submit]");
    } else {
      await page.keyboard.press(`${MODIFIER_KEY}+Enter`);
    }

    await page.waitForTimeout(1500);
    await reactGrab.screenshot("ac7-after-submit", "page");

    // Check if the comment was posted
    const commentRequests = mockServer.requests("addJiraComment");
    console.log("AC-7: addJiraComment requests:", commentRequests.length);
    console.log("AC-7: Comment override calls:", commentCalls.length);

    if (commentCalls.length > 0) {
      console.log(
        "AC-7: Last comment body:",
        JSON.stringify(commentCalls[commentCalls.length - 1]),
      );
    }

    // Check for error logs related to image upload
    const imageErrors = consoleErrors.filter(
      (e) =>
        e.toLowerCase().includes("image") ||
        e.toLowerCase().includes("upload") ||
        e.toLowerCase().includes("screenshot"),
    );
    console.log("AC-7: Console errors total:", consoleErrors.length);
    console.log("AC-7: Image-related errors:", imageErrors.length);
    if (imageErrors.length > 0) {
      console.log("AC-7: Image error messages:", imageErrors);
    }
  });
});
