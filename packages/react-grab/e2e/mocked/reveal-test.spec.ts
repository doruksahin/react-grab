import { test, expect } from "../fixtures.js";

/**
 * Quick test: do revealed selections from initSync show as labels on the page?
 * The mock fixture sel-1 has revealed: true + elementSelectors: ["nav.main-nav"]
 * The e2e-app has a <nav class="main-nav"> element.
 *
 * Uses mockServer fixture for HTTP interception + manual initSync.
 */

test.use({ video: "on" });

test("revealed selections should anchor to DOM elements", { tag: ["@SPEC-010"] }, async ({
  page,
  reactGrab,
  mockServer,
}) => {
  // mockServer routes registered during fixture setup. Now trigger initSync.
  await reactGrab.triggerInitSync();

  // Wait for overlay to be ready
  await expect
    .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
    .toBe(true);

  // Take immediate screenshot — are there already labels on the page?
  await reactGrab.screenshot("initial-state", "page");

  // Check if any selection labels exist
  const labelCount = await page.evaluate(() => {
    const host = document.querySelector("[data-react-grab]");
    const root = host?.shadowRoot?.querySelector("[data-react-grab]");
    if (!root) return 0;
    return root.querySelectorAll("[data-react-grab-selection-label]").length;
  });
  console.log(`Selection labels found: ${labelCount}`);

  // Check if any grabbed boxes exist (the highlight rectangles)
  const boxCount = await page.evaluate(() => {
    const host = document.querySelector("[data-react-grab]");
    const root = host?.shadowRoot?.querySelector("[data-react-grab]");
    if (!root) return 0;
    return root.querySelectorAll("[data-react-grab-grabbed-box]").length;
  });
  console.log(`Grabbed boxes found: ${boxCount}`);

  // Wait a bit for reveal effect to fire, then check again
  await page.waitForTimeout(2000);
  await reactGrab.screenshot("after-wait", "page");

  const labelCount2 = await page.evaluate(() => {
    const host = document.querySelector("[data-react-grab]");
    const root = host?.shadowRoot?.querySelector("[data-react-grab]");
    if (!root) return 0;
    return root.querySelectorAll("[data-react-grab-selection-label]").length;
  });
  console.log(`Selection labels after wait: ${labelCount2}`);

  // Check full state
  const state = await page.evaluate(() => {
    const api = (window as any).__REACT_GRAB__;
    if (!api) return null;
    const s = api.getState();
    return {
      labelInstances: s.labelInstances?.length ?? 0,
      grabbedBoxes: s.grabbedBoxes?.length ?? 0,
      commentItems: s.commentItems?.length ?? "no field",
      groups: s.groups?.length ?? "no field",
      allStateKeys: Object.keys(s),
    };
  });
  for (const [k, v] of Object.entries(state ?? {})) {
    console.log(`  state.${k}: ${JSON.stringify(v)}`);
  }

  // Check if nav.main-nav element exists on the page
  const navExists = await page.evaluate(
    () => document.querySelector("nav.main-nav") !== null,
  );
  console.log(`nav.main-nav exists: ${navExists}`);

  // Check what the mock server received
  const commentsReqs = mockServer.requests("listComments");
  const groupsReqs = mockServer.requests("listGroups");
  console.log(`listComments requests: ${commentsReqs.length}`);
  console.log(`listGroups requests: ${groupsReqs.length}`);
  if (commentsReqs.length > 0) {
    console.log(`  comments URL: ${commentsReqs[0].url}`);
  }
  if (groupsReqs.length > 0) {
    console.log(`  groups URL: ${groupsReqs[0].url}`);
  }

  // Try activating the overlay — maybe reveals only show when active
  await reactGrab.activate();
  await page.waitForTimeout(1000);
  await reactGrab.screenshot("after-activate", "page");

  const labelCount3 = await page.evaluate(() => {
    const host = document.querySelector("[data-react-grab]");
    const root = host?.shadowRoot?.querySelector("[data-react-grab]");
    if (!root) return 0;
    return root.querySelectorAll("[data-react-grab-selection-label]").length;
  });
  console.log(`Labels after activate: ${labelCount3}`);
});
