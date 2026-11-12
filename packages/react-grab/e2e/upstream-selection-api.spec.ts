import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import type { ReactGrabAPI } from "react-grab-upstream/core";

declare global {
  interface Window {
    selectionEngine: ReactGrabAPI;
  }
}

let engineScript: string;

test.beforeAll(async () => {
  const result = await build({
    bundle: true,
    write: false,
    define: { "process.env.NODE_ENV": '"production"' },
    stdin: {
      resolveDir: fileURLToPath(new URL("..", import.meta.url)),
      contents:
        'import { init } from "react-grab-upstream/core"; window.selectionEngine = init({telemetry:false}); window.selectionEngine.registerPlugin({name:"product",theme:{enabled:false,toolbar:{enabled:false}}});',
    },
  });
  if (!result.outputFiles[0])
    throw new Error("Selection engine bundle was not generated");
  engineScript = result.outputFiles[0].text;
});

test("patched selection API shares native state and rejects invalid lifecycle calls", async ({
  page,
}) => {
  await page.route("**/*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><body><button id="target">Selection target</button></body>',
    }),
  );
  await page.goto("http://selection.test");
  await page.addScriptTag({ content: engineScript });
  const result = await page.evaluate(() => {
    const element = document.querySelector("#target");
    if (!element) throw new Error("Target is missing");
    const engine = window.selectionEngine;
    const inactive = engine.selectElement(element);
    engine.activate();
    const active = engine.selectElement(element);
    const selected = engine.getState().targetElement === element;
    const disconnected = engine.selectElement(document.createElement("button"));
    const foreignDocument = document.implementation.createHTMLDocument();
    const foreign = engine.selectElement(foreignDocument.body);
    engine.reset();
    const reset = engine.selectElement(element);
    engine.activate();
    engine.dispose();
    const disposed = engine.selectElement(element);
    return {
      inactive,
      active,
      selected,
      disconnected,
      foreign,
      reset,
      disposed,
    };
  });
  expect(result).toEqual({
    inactive: false,
    active: true,
    selected: true,
    disconnected: false,
    foreign: false,
    reset: false,
    disposed: false,
  });
});
