import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {} from "../../e2e-app/src/freeze-contract.js";

interface FreezeContractBundles {
  engine: string;
  host: string;
}

declare global {
  interface Window {
    freezeEngine: {
      activate: () => void;
      reset: () => void;
      dispose: () => void;
    };
  }
}

const PACKAGE_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const FREEZE_OBSERVATION_MS = 100;
const ROOT_SUBSCRIBER_COUNT = 6;

for (const entryPoint of ["core", "primitives"]) {
  for (const environment of ["development", "production"]) {
    for (const moduleFormat of ["esm", "cjs"]) {
      test.describe(`${entryPoint} ${environment} ${moduleFormat} consumer freeze`, () => {
        let bundles: FreezeContractBundles;
        test.beforeAll(async () => {
          const common = {
            bundle: true,
            write: false,
            minify: environment === "production",
            define: { "process.env.NODE_ENV": JSON.stringify(environment) },
          };
          const primitiveImport =
            moduleFormat === "esm"
              ? 'import { freeze, unfreeze } from "./dist/primitives.js";'
              : 'const { freeze, unfreeze } = require("./dist/primitives.cjs");';
          const engineEntry =
            entryPoint === "core"
              ? 'import { init } from "react-grab-upstream/core";window.freezeEngine=init({telemetry:false,freezeReactUpdates:true});window.freezeEngine.registerPlugin({name:"external-ui",theme:{enabled:false,toolbar:{enabled:false}}});'
              : `${primitiveImport}window.freezeEngine={activate:freeze,reset:unfreeze,dispose:unfreeze};`;
          const [engine, host] = await Promise.all([
            build({
              ...common,
              format: moduleFormat === "esm" ? "esm" : "cjs",
              stdin: {
                contents: engineEntry,
                resolveDir: PACKAGE_DIRECTORY,
              },
            }),
            build({
              ...common,
              entryPoints: [
                path.join(
                  PACKAGE_DIRECTORY,
                  "../e2e-app/src/freeze-contract.ts",
                ),
              ],
            }),
          ]);
          if (!engine.outputFiles?.[0] || !host.outputFiles?.[0]) {
            throw new Error("Freeze contract bundles were not generated");
          }
          bundles = {
            engine: engine.outputFiles[0].text,
            host: host.outputFiles[0].text,
          };
        });

        for (const getter of ["stable", "inline"]) {
          for (const strict of [false, true]) {
            for (const scenario of [
              "store-only",
              "retained-state",
              "unmount",
              "error",
              "error-recovery",
            ]) {
              test(`${getter}, strict=${strict}, ${scenario}`, async ({
                page,
              }) => {
                const errors: string[] = [];
                page.on("pageerror", (error) => errors.push(error.message));
                await page.route("**/*", (route) => {
                  const url = new URL(route.request().url());
                  if (url.origin !== "http://freeze.test") return route.abort();
                  if (url.pathname === "/engine.js")
                    return route.fulfill({
                      contentType: "text/javascript",
                      body: bundles.engine,
                    });
                  if (url.pathname === "/host.js")
                    return route.fulfill({
                      contentType: "text/javascript",
                      body: bundles.host,
                    });
                  return route.fulfill({
                    contentType: "text/html",
                    body: '<!doctype html><body><script src="/engine.js"></script><script src="/host.js"></script></body>',
                  });
                });
                await page.goto(
                  `http://freeze.test/?getter=${getter}&strict=${strict}&scenario=${scenario}`,
                );
                expect(errors).toEqual([]);
                await page.waitForFunction(
                  (count) =>
                    window.freezeContract?.ready &&
                    window.freezeContract.subscribers() === count,
                  ROOT_SUBSCRIBER_COUNT,
                );
                for (let cycle = 1; cycle <= 2; cycle++) {
                  const before = await page.locator("output").allTextContents();
                  await page.evaluate(() => window.freezeEngine.activate());
                  if (entryPoint === "core")
                    await expect(
                      page.locator("[data-react-grab-toolbar]"),
                    ).toHaveCount(0);
                  await page.evaluate(
                    (value) => window.freezeContract.update(value),
                    cycle,
                  );
                  if (scenario === "retained-state")
                    await page.evaluate(() =>
                      window.freezeContract.incrementState(),
                    );
                  await page.waitForTimeout(FREEZE_OBSERVATION_MS);
                  expect(
                    await page.locator("output").allTextContents(),
                  ).toEqual(before);
                  if (scenario === "unmount") {
                    await page.evaluate(() => {
                      window.freezeContract.unmount();
                      window.freezeEngine.reset();
                      window.freezeContract.update(9);
                    });
                    expect(
                      await page.evaluate(() =>
                        window.freezeContract.subscribers(),
                      ),
                    ).toBe(0);
                    break;
                  }
                  if (scenario === "error-recovery") {
                    await page.evaluate(() => window.freezeContract.update(2));
                    await page.waitForTimeout(FREEZE_OBSERVATION_MS);
                    expect(
                      await page.locator("output").allTextContents(),
                    ).toEqual(before);
                  }
                  await page.evaluate(() => window.freezeEngine.reset());
                  if (scenario.startsWith("error")) {
                    const expected =
                      scenario === "error"
                        ? "ERROR"
                        : JSON.stringify([0, 2, 2, 2]);
                    await expect(page.locator("#first")).toHaveText(expected);
                    await expect(page.locator("#second")).toHaveText(expected);
                    break;
                  }
                  const expected = JSON.stringify([
                    scenario === "retained-state" ? cycle : 0,
                    cycle,
                    cycle,
                    cycle,
                  ]);
                  await expect(page.locator("#first")).toHaveText(expected);
                  await expect(page.locator("#second")).toHaveText(expected);
                  expect(
                    await page.evaluate(() =>
                      window.freezeContract.subscribers(),
                    ),
                  ).toBe(ROOT_SUBSCRIBER_COUNT);
                }
                await page.evaluate(() => {
                  window.freezeEngine.dispose();
                  window.freezeContract.unmount();
                });
                expect(
                  await page.evaluate(() =>
                    window.freezeContract.subscribers(),
                  ),
                ).toBe(0);
                expect(errors).toEqual([]);
              });
            }
          }
        }
      });
    }
  }
}
