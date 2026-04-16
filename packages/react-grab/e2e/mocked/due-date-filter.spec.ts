import { test, expect } from "../fixtures.js";

/**
 * E2E coverage for the sidebar due-date filter (SPEC-018).
 *
 * Uses reactGrab.populate() to seed groups with varied jiraDueDate values.
 * No HTTP — the filter is pure client-side over the already-loaded store.
 */

const ATTR = "data-react-grab";

// ---------------------------------------------------------------------------
// Shadow DOM helpers
// ---------------------------------------------------------------------------

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

const isSidebarVisible = async (
  page: import("@playwright/test").Page,
): Promise<boolean> =>
  page.evaluate((attrName) => {
    const host = document.querySelector(`[${attrName}]`);
    const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
    return Boolean(
      root?.querySelector("[role='dialog'][aria-label='React Grab Dashboard']"),
    );
  }, ATTR);

const countVisibleGroupCards = async (
  page: import("@playwright/test").Page,
): Promise<number> =>
  page.evaluate((attrName) => {
    const host = document.querySelector(`[${attrName}]`);
    const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
    return root
      ? root.querySelectorAll("[data-react-grab-group-card]").length
      : 0;
  }, ATTR);

/**
 * The due-date filter is now inside a nested DropdownMenu (FilterMenu).
 * Interaction flow:
 *   1. Click the parent "Filter" trigger (MenuTrigger inside [data-react-grab-filter-menu])
 *      → portalled MenuContent appears in the shadow root.
 *   2. Click the due-date SubTrigger ([data-react-grab-due-date-filter])
 *      → portalled MenuSubContent appears in the shadow root.
 *   3. Click the desired option (role="menuitemradio").
 *
 * All portalled nodes live in host.shadowRoot because FilterMenu mounts its
 * Portal via useShadowMount() which returns the ShadowRoot.
 */

/** Return the bounding centre of the Filter menu trigger button. */
const boundingCentreOfFilterTrigger = (page: import("@playwright/test").Page) =>
  page.evaluate((attrName) => {
    const host = document.querySelector(`[${attrName}]`);
    const root = host?.shadowRoot;
    const trigger = root?.querySelector<HTMLElement>(
      "[data-react-grab-filter-menu] button",
    );
    if (!trigger) return null;
    const rect = trigger.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, ATTR);

/** After the parent menu is open, return the bounding centre of the due-date SubTrigger. */
const boundingCentreOfDueDateTrigger = (
  page: import("@playwright/test").Page,
) =>
  page.evaluate((attrName) => {
    const host = document.querySelector(`[${attrName}]`);
    const root = host?.shadowRoot;
    const el = root?.querySelector(
      "[data-react-grab-due-date-filter]",
    ) as HTMLElement | null;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, ATTR);

/** role="menuitemradio" is what Kobalte DropdownMenu.RadioItem renders. */
const boundingCentreOfOptionByLabel = (
  page: import("@playwright/test").Page,
  label: string,
) =>
  page.evaluate(
    ({ attrName, target }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot;
      if (!root) return null;
      const options = Array.from(
        root.querySelectorAll<HTMLElement>("[role='menuitemradio']"),
      );
      const el = options.find((opt) => opt.textContent?.trim() === target);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    },
    { attrName: ATTR, target: label },
  );

/** Return the bounding centre of any filter sub-trigger by its data-react-grab-filter-row value. */
const boundingCentreOfFilterRow = (
  page: import("@playwright/test").Page,
  row: string,
) =>
  page.evaluate(
    ({ attrName, rowVal }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot;
      const el = root?.querySelector<HTMLElement>(
        `[data-react-grab-filter-row="${rowVal}"]`,
      );
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    },
    { attrName: ATTR, rowVal: row },
  );

/** Count currently visible menuitemradio elements in the shadow root. */
const countOpenSubMenuOptions = (page: import("@playwright/test").Page) =>
  page.evaluate((attrName) => {
    const host = document.querySelector(`[${attrName}]`);
    return (
      host?.shadowRoot?.querySelectorAll("[role='menuitemradio']").length ?? 0
    );
  }, ATTR);

/** Open the filter trigger only (without opening a sub-menu). */
const openFilterMenu = async (page: import("@playwright/test").Page) => {
  await expect
    .poll(() => boundingCentreOfFilterTrigger(page), { timeout: 5000 })
    .not.toBeNull();
  const box = await boundingCentreOfFilterTrigger(page);
  if (!box) throw new Error("filter menu trigger not found");
  await page.mouse.click(box.x, box.y);
  // Wait for the menu content to be visible (at least one sub-trigger row)
  await expect
    .poll(() => boundingCentreOfFilterRow(page, "status"), { timeout: 5000 })
    .not.toBeNull();
};

const openDueDateFilter = async (page: import("@playwright/test").Page) => {
  // Step 1: click the Filter trigger with real pointer events so Kobalte opens the menu.
  await expect
    .poll(() => boundingCentreOfFilterTrigger(page), { timeout: 5000 })
    .not.toBeNull();
  const triggerBox = await boundingCentreOfFilterTrigger(page);
  if (!triggerBox) throw new Error("filter menu trigger not found");
  await page.mouse.click(triggerBox.x, triggerBox.y);
  // Step 2: click the due-date SubTrigger, now visible in the portalled MenuContent.
  await expect
    .poll(() => boundingCentreOfDueDateTrigger(page), { timeout: 5000 })
    .not.toBeNull();
  const box = await boundingCentreOfDueDateTrigger(page);
  if (!box) throw new Error("due-date trigger not found");
  await page.mouse.click(box.x, box.y);
};

const pickDueDateOption = async (
  page: import("@playwright/test").Page,
  label: string,
) => {
  await expect
    .poll(() => boundingCentreOfOptionByLabel(page, label), { timeout: 5000 })
    .not.toBeNull();
  const box = await boundingCentreOfOptionByLabel(page, label);
  if (!box) throw new Error(`option '${label}' not found`);
  await page.mouse.click(box.x, box.y);
  // FilterMenu uses closeOnSelect=false to keep the menu open for multi-filter
  // sessions. Dismiss explicitly with Escape so subsequent interactions are clean.
  await page.keyboard.press("Escape");
  await expect
    .poll(
      () =>
        page.evaluate((attrName) => {
          const host = document.querySelector(`[${attrName}]`);
          return (
            host?.shadowRoot?.querySelectorAll("[role='menuitemradio']")
              .length ?? 0
          );
        }, ATTR),
      { timeout: 3000 },
    )
    .toBe(0);
};

/** Click the "✕ Clear" button that appears when any filter is active. */
const clickClearFilters = async (page: import("@playwright/test").Page) => {
  const box = await page.evaluate((attrName) => {
    const host = document.querySelector(`[${attrName}]`);
    const root = host?.shadowRoot;
    if (!root) return null;
    const btn = Array.from(
      root.querySelectorAll<HTMLButtonElement>("button"),
    ).find((b) => b.textContent?.trim() === "✕ Clear");
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, ATTR);
  if (!box) throw new Error("✕ Clear button not found");
  await page.mouse.click(box.x, box.y);
};

const openSidebar = async (page: import("@playwright/test").Page) => {
  await clickShadowButton(page, "[data-react-grab-toolbar-dashboard]");
  await expect.poll(() => isSidebarVisible(page), { timeout: 5000 }).toBe(true);
};

// ---------------------------------------------------------------------------
// Seed builder — 6 groups, one per bucket, using real-clock-relative offsets
// so the test is robust to the current date.
// ---------------------------------------------------------------------------

const isoOffsetFromToday = (offsetDays: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
};

const makeGroup = (
  id: string,
  name: string,
  due: string | null,
): Record<string, unknown> => ({
  id,
  name,
  createdAt: Date.now(),
  revealed: false,
  status: "ticketed",
  jiraTicketId: `ATT-${id}`,
  synthetic: false,
  jiraStatus: "In Progress",
  jiraStatusCategory: "In Progress",
  jiraAssignee: "Alice Cooper",
  jiraReporter: "Bob Martinez",
  jiraAssigneeAvatar: null,
  jiraReporterAvatar: null,
  jiraLabels: [],
  jiraComments: [],
  jiraResolved: false,
  jiraUrl: `https://example.atlassian.net/browse/ATT-${id}`,
  jiraDueDate: due,
});

const seedGroups = () => ({
  groups: [
    makeGroup("g-overdue", "Overdue ticket", isoOffsetFromToday(-3)),
    makeGroup("g-today", "Due today ticket", isoOffsetFromToday(0)),
    makeGroup("g-this-wk", "This-week ticket", isoOffsetFromToday(1)),
    makeGroup("g-next-7", "Next-7-days ticket", isoOffsetFromToday(6)),
    makeGroup("g-later", "Later ticket", isoOffsetFromToday(30)),
    makeGroup("g-no-date", "No due date ticket", null),
  ],
  comments: [],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Due date filter (SPEC-018)", { tag: ["@SPEC-018"] }, () => {
  test.beforeEach(async ({ reactGrab }) => {
    await reactGrab.populate(seedGroups());
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
  });

  test("AC-1: default (All due dates) shows all seeded groups", async ({
    reactGrab,
  }) => {
    const { page } = reactGrab;
    await openSidebar(page);
    await expect
      .poll(() => countVisibleGroupCards(page), { timeout: 3000 })
      .toBe(6);
  });

  test("AC-2: 'Overdue' shows only past-due groups", async ({ reactGrab }) => {
    const { page } = reactGrab;
    await openSidebar(page);
    await openDueDateFilter(page);
    await pickDueDateOption(page, "Overdue");
    await expect
      .poll(() => countVisibleGroupCards(page), { timeout: 3000 })
      .toBe(1);
  });

  test("AC-3: 'Due today' shows only today's group", async ({ reactGrab }) => {
    const { page } = reactGrab;
    await openSidebar(page);
    await openDueDateFilter(page);
    await pickDueDateOption(page, "Due today");
    await expect
      .poll(() => countVisibleGroupCards(page), { timeout: 3000 })
      .toBe(1);
  });

  test("AC-4: 'Next 7 days' shows today + next week bucket", async ({
    reactGrab,
  }) => {
    const { page } = reactGrab;
    await openSidebar(page);
    await openDueDateFilter(page);
    await pickDueDateOption(page, "Next 7 days");
    // today (0), this-wk (+1), next-7 (+6) — all within [today, today+7]
    await expect
      .poll(() => countVisibleGroupCards(page), { timeout: 3000 })
      .toBe(3);
  });

  test("AC-5: 'No due date' shows only the dateless group", async ({
    reactGrab,
  }) => {
    const { page } = reactGrab;
    await openSidebar(page);
    await openDueDateFilter(page);
    await pickDueDateOption(page, "No due date");
    await expect
      .poll(() => countVisibleGroupCards(page), { timeout: 3000 })
      .toBe(1);
  });

  test("AC-6: '✕ Clear' resets due-date preset along with other filters", async ({
    reactGrab,
  }) => {
    const { page } = reactGrab;
    await openSidebar(page);
    // Start with a due-date preset active — sanity-check it narrowed the list.
    await openDueDateFilter(page);
    await pickDueDateOption(page, "Overdue");
    await expect
      .poll(() => countVisibleGroupCards(page), { timeout: 3000 })
      .toBe(1);

    // Clicking the shared "✕ Clear" button restores the full list, proving the
    // due-date field is part of the same hasActiveFilter / handleClear scope as
    // the other four filters.
    await clickClearFilters(page);
    await expect
      .poll(() => countVisibleGroupCards(page), { timeout: 3000 })
      .toBe(6);
  });

  test("AC-7: opening a second sub closes the first (single-open-sub invariant)", async ({
    reactGrab,
  }) => {
    const { page } = reactGrab;
    await openSidebar(page);

    // Open the filter menu and click the Status sub-trigger.
    await openFilterMenu(page);
    const statusBox = await boundingCentreOfFilterRow(page, "status");
    if (!statusBox) throw new Error("status sub-trigger not found");
    await page.mouse.click(statusBox.x, statusBox.y);

    // Status sub should now be open — radio items visible.
    await expect
      .poll(() => countOpenSubMenuOptions(page), { timeout: 3000 })
      .toBeGreaterThan(0);

    // Now click the Due Date sub-trigger. Status sub must close.
    const dueDateBox = await boundingCentreOfFilterRow(page, "due-date");
    if (!dueDateBox) throw new Error("due-date sub-trigger not found");
    await page.mouse.click(dueDateBox.x, dueDateBox.y);

    // Due Date sub is open. The radio items visible are now Due Date's options only.
    // The Status sub's "All Statuses" option must not be in the shadow root.
    // Poll because solid-presence runs its cleanup effect in a microtask after the click.
    await expect
      .poll(
        () =>
          page.evaluate((attrName) => {
            const host = document.querySelector(`[${attrName}]`);
            const root = host?.shadowRoot;
            if (!root) return false;
            return Array.from(
              root.querySelectorAll("[role='menuitemradio']"),
            ).some((el) => el.textContent?.trim() === "All Statuses");
          }, ATTR),
        { timeout: 3000 },
      )
      .toBe(false);

    // Due Date sub's "All due dates" option must be visible.
    const allDueDatesVisible = await page.evaluate((attrName) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot;
      if (!root) return false;
      return Array.from(root.querySelectorAll("[role='menuitemradio']")).some(
        (el) => el.textContent?.trim() === "All due dates",
      );
    }, ATTR);
    expect(allDueDatesVisible).toBe(true);

    await page.keyboard.press("Escape");
  });

  test("AC-8: Left Arrow inside an open sub closes it and returns to parent menu", async ({
    reactGrab,
  }) => {
    const { page } = reactGrab;
    await openSidebar(page);

    // Open filter menu and then the due-date sub.
    await openDueDateFilter(page);

    // Sub is open — radio items are visible.
    await expect
      .poll(() => countOpenSubMenuOptions(page), { timeout: 3000 })
      .toBeGreaterThan(0);

    // Press Left Arrow — Kobalte closes the sub and moves focus to parent menu.
    await page.keyboard.press("ArrowLeft");

    // Sub must be closed — no more radio items in the shadow root.
    await expect
      .poll(() => countOpenSubMenuOptions(page), { timeout: 3000 })
      .toBe(0);

    // Parent menu must still be open — at least the due-date sub-trigger is visible.
    await expect
      .poll(() => boundingCentreOfFilterRow(page, "due-date"), { timeout: 3000 })
      .not.toBeNull();

    await page.keyboard.press("Escape");
  });
});
