import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "./fixtures.js";
import type {} from "../../e2e-app/src/freeze-contract.js";

const FREEZE_OBSERVATION_MS = 100;
const INITIAL_SNAPSHOT = JSON.stringify([0, 0, "undefined", 0]);
const UPDATED_SNAPSHOT = JSON.stringify([1, 3, 3, 3]);
const HOST_ENTRY = fileURLToPath(
  new URL("../../e2e-app/src/freeze-contract.ts", import.meta.url),
);

for (const environment of ["development", "production"]) {
  test.describe(`Toolbar freeze ownership ${environment}`, () => {
    let hostScript: string;
    test.beforeAll(async () => {
      const result = await build({
        absWorkingDir: path.dirname(HOST_ENTRY),
        entryPoints: [HOST_ENTRY],
        bundle: true,
        write: false,
        define: { "process.env.NODE_ENV": JSON.stringify(environment) },
      });
      if (!result.outputFiles[0])
        throw new Error("Freeze host bundle was not generated");
      hostScript = result.outputFiles[0].text;
    });
    test.beforeEach(async ({ reactGrab }) => {
      await reactGrab.page.addScriptTag({ content: hostScript });
      await reactGrab.page.waitForFunction(
        () =>
          window.freezeContract?.ready &&
          window.freezeContract.subscribers() === 6,
      );
      await expect(reactGrab.page.locator("output")).toHaveText([
        INITIAL_SNAPSHOT,
        INITIAL_SNAPSHOT,
      ]);
    });

    for (const lifecycle of [
      "leave",
      "activate",
      "already-active",
      "dispose",
    ]) {
      test(`${lifecycle} retains and releases the store snapshot`, async ({
        reactGrab,
      }) => {
        if (lifecycle === "already-active") await reactGrab.activate();
        const select = reactGrab.page.getByRole("button", {
          name:
            lifecycle === "already-active"
              ? "Stop selecting element"
              : "Select element",
          exact: true,
        });
        await select.hover();
        await reactGrab.page.evaluate(() => {
          window.freezeContract.update(3);
          window.freezeContract.incrementState();
        });
        await reactGrab.page.waitForTimeout(FREEZE_OBSERVATION_MS);
        await expect(reactGrab.page.locator("output")).toHaveText([
          INITIAL_SNAPSHOT,
          INITIAL_SNAPSHOT,
        ]);
        if (lifecycle === "activate") await select.click();
        if (lifecycle === "dispose") {
          await reactGrab.page.evaluate(() => window.__REACT_GRAB__?.dispose());
        } else {
          await reactGrab.page.mouse.move(0, 0);
          if (lifecycle !== "leave") {
            await reactGrab.page.waitForTimeout(FREEZE_OBSERVATION_MS);
            await expect(reactGrab.page.locator("output")).toHaveText([
              INITIAL_SNAPSHOT,
              INITIAL_SNAPSHOT,
            ]);
            await reactGrab.page.keyboard.press("Escape");
          }
        }
        await expect(reactGrab.page.locator("output")).toHaveText([
          UPDATED_SNAPSHOT,
          UPDATED_SNAPSHOT,
        ]);
        await reactGrab.page.evaluate(() => window.freezeContract.update(4));
        await expect(reactGrab.page.locator("output")).toHaveText([
          JSON.stringify([1, 4, 4, 4]),
          JSON.stringify([1, 4, 4, 4]),
        ]);
      });
    }
  });
}
