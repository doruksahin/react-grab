// packages/react-grab/src/core/plugins/recorder/serialize.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { toRecorderUserFlow } from "./serialize.js";
import type { CapturedStep } from "./types.js";
import type { ResolveComponentInfo } from "./component-info.js";

const stubResolver: ResolveComponentInfo = async () => ({
  component: "Foo",
  file: "src/foo.tsx:10",
});
const nullResolver: ResolveComponentInfo = async () => ({
  component: null,
  file: null,
});

const fakeStep = (kind: CapturedStep["kind"], selector = "#x"): CapturedStep => ({
  id: "id",
  timestamp: 0,
  element: document.createElement("button"),
  selector,
  kind,
});

describe("toRecorderUserFlow", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { value: 1024, writable: true });
    Object.defineProperty(window, "innerHeight", { value: 768, writable: true });
    Object.defineProperty(window, "devicePixelRatio", { value: 2, writable: true });
    Object.defineProperty(window, "location", {
      value: { href: "https://example.com/" },
      writable: true,
    });
  });

  it("emits exactly setViewport then navigate as the first two steps", async () => {
    const flow = await toRecorderUserFlow([], stubResolver);
    expect(flow.steps).toHaveLength(2);
    expect(flow.steps[0].type).toBe("setViewport");
    expect(flow.steps[1]).toEqual({ type: "navigate", url: "https://example.com/" });
  });

  it("maps a click step with extras when component info is available", async () => {
    const step = fakeStep({ type: "click", offsetX: 5, offsetY: 6 }, "#go");
    const flow = await toRecorderUserFlow([step], stubResolver);
    const click = flow.steps[2];
    expect(click.type).toBe("click");
    if (click.type !== "click") throw new Error("unreachable");
    expect(click.selectors).toEqual([["#go"]]);
    expect(click.offsetX).toBe(5);
    expect(click.offsetY).toBe(6);
    expect(click["react-grab.component"]).toBe("Foo");
    expect(click["react-grab.file"]).toBe("src/foo.tsx:10");
  });

  it("maps a click step without extras when component info is null", async () => {
    const step = fakeStep({ type: "click", offsetX: 0, offsetY: 0 }, "#go");
    const flow = await toRecorderUserFlow([step], nullResolver);
    const click = flow.steps[2];
    if (click.type !== "click") throw new Error("unreachable");
    expect("react-grab.component" in click).toBe(false);
    expect("react-grab.file" in click).toBe(false);
  });

  it("maps a change step with value and selectors", async () => {
    const step = fakeStep({ type: "change", value: "hi" }, "#field");
    const flow = await toRecorderUserFlow([step], stubResolver);
    const change = flow.steps[2];
    expect(change.type).toBe("change");
    if (change.type !== "change") throw new Error("unreachable");
    expect(change.value).toBe("hi");
    expect(change.selectors).toEqual([["#field"]]);
  });

  it("title contains 'react-grab recording' and a parseable ISO timestamp", async () => {
    const flow = await toRecorderUserFlow([], stubResolver);
    expect(flow.title).toMatch(/^react-grab recording \d{4}-\d{2}-\d{2}T/);
  });

  it("every non-standard field is namespaced under react-grab.", async () => {
    const click = fakeStep({ type: "click", offsetX: 0, offsetY: 0 }, "#x");
    const change = fakeStep({ type: "change", value: "v" }, "#y");
    const flow = await toRecorderUserFlow([click, change], stubResolver);
    const knownFields = new Set([
      "type", "selectors", "offsetX", "offsetY", "value",
      "width", "height", "deviceScaleFactor", "isMobile", "hasTouch", "isLandscape", "url",
    ]);
    for (const step of flow.steps) {
      for (const key of Object.keys(step)) {
        if (knownFields.has(key)) continue;
        expect(key.startsWith("react-grab.")).toBe(true);
      }
    }
  });
});
