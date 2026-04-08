// packages/react-grab/src/core/plugins/recorder/build-step.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../utils/create-element-selector.js", () => ({
  createElementSelector: vi.fn((_el: Element) => "#stub"),
}));

import { buildClickStep, buildChangeStep } from "./build-step.js";
import { createElementSelector } from "../../../utils/create-element-selector.js";

const makePointerDown = (target: Element, x = 5, y = 7): PointerEvent => {
  const event = new PointerEvent("pointerdown", { bubbles: true });
  Object.defineProperty(event, "target", { value: target });
  Object.defineProperty(event, "offsetX", { value: x });
  Object.defineProperty(event, "offsetY", { value: y });
  return event;
};

const makeChange = (target: Element): Event => {
  const event = new Event("change", { bubbles: true });
  Object.defineProperty(event, "target", { value: target });
  return event;
};

describe("buildClickStep", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.mocked(createElementSelector).mockReturnValue("#stub");
  });

  it("returns a click step with selector, offsets, element ref, id, timestamp", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    const step = buildClickStep(makePointerDown(button, 10, 20));
    expect(step).not.toBeNull();
    expect(step!.selector).toBe("#stub");
    expect(step!.element).toBe(button);
    expect(step!.kind).toEqual({ type: "click", offsetX: 10, offsetY: 20 });
    expect(step!.id).toMatch(/[0-9a-f-]{36}/);
    expect(typeof step!.timestamp).toBe("number");
  });

  it("returns null when target is inside [data-react-grab] shadow host", () => {
    const host = document.createElement("div");
    host.setAttribute("data-react-grab", "");
    const child = document.createElement("button");
    host.appendChild(child);
    document.body.appendChild(host);
    expect(buildClickStep(makePointerDown(child))).toBeNull();
  });

  it("returns null when target ancestor has data-react-grab-ignore", () => {
    const wrap = document.createElement("section");
    wrap.setAttribute("data-react-grab-ignore", "");
    const child = document.createElement("button");
    wrap.appendChild(child);
    document.body.appendChild(wrap);
    expect(buildClickStep(makePointerDown(child))).toBeNull();
  });

  it("returns null when target is not an Element", () => {
    const event = new PointerEvent("pointerdown");
    Object.defineProperty(event, "target", { value: null });
    expect(buildClickStep(event)).toBeNull();
  });

  it("returns null when createElementSelector throws", () => {
    vi.mocked(createElementSelector).mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const button = document.createElement("button");
    document.body.appendChild(button);
    expect(buildClickStep(makePointerDown(button))).toBeNull();
  });
});

describe("buildChangeStep", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.mocked(createElementSelector).mockReturnValue("#stub");
  });

  it("returns a change step with the input value", () => {
    const input = document.createElement("input");
    input.value = "hello";
    document.body.appendChild(input);
    const step = buildChangeStep(makeChange(input));
    expect(step).not.toBeNull();
    expect(step!.kind).toEqual({ type: "change", value: "hello" });
  });

  it("masks <input type=password> values to bullets", () => {
    const input = document.createElement("input");
    input.type = "password";
    input.value = "supersecret";
    document.body.appendChild(input);
    const step = buildChangeStep(makeChange(input));
    expect(step).not.toBeNull();
    expect((step!.kind as { type: "change"; value: string }).value).toBe("••••");
  });

  it("returns null for non-form-control targets", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    expect(buildChangeStep(makeChange(div))).toBeNull();
  });

  it("returns null when ancestor has data-react-grab-ignore", () => {
    const wrap = document.createElement("section");
    wrap.setAttribute("data-react-grab-ignore", "");
    const input = document.createElement("input");
    input.value = "x";
    wrap.appendChild(input);
    document.body.appendChild(wrap);
    expect(buildChangeStep(makeChange(input))).toBeNull();
  });
});
