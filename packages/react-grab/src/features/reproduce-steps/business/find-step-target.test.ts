import { afterEach, describe, expect, it } from "vitest";
import { findStepTarget } from "./find-step-target.js";

const click = (...selectors: string[]) => ({
  type: "click" as const,
  selectors,
  offsetX: 1,
  offsetY: 1,
});

const byId = (id: string) => document.getElementById(id);

afterEach(() => {
  document.body.innerHTML = "";
});

describe("findStepTarget", () => {
  it("finds a unique CSS match first", () => {
    document.body.innerHTML = '<button id="save">Save</button>';
    expect(findStepTarget(click("#save"), document)).toBe(byId("save"));
  });

  it("finds an element by its role and accessible name", () => {
    document.body.innerHTML =
      '<div role="tablist"><button role="tab" id="general">General</button><button role="tab" id="billing">Billing</button></div>';
    expect(
      findStepTarget(click('aria/Billing[role="tab"]', "#gone"), document),
    ).toBe(byId("billing"));
  });

  it("finds an element by its name when no role was stored", () => {
    document.body.innerHTML = '<a href="#" id="docs">Docs</a>';
    expect(findStepTarget(click("aria/Docs"), document)).toBe(byId("docs"));
  });

  it("finds the innermost element with the stored text", () => {
    document.body.innerHTML =
      '<div><p><span id="label">Change plan</span></p></div>';
    expect(findStepTarget(click("text/Change plan"), document)).toBe(
      byId("label"),
    );
  });

  it("skips a selector that matches more than one element", () => {
    document.body.innerHTML =
      '<button class="b">A</button><button class="b" id="b2">B</button>';
    expect(findStepTarget(click(".b", "text/B"), document)).toBe(byId("b2"));
  });

  it("ignores hidden elements", () => {
    document.body.innerHTML =
      '<button style="display:none">Save</button><button id="shown">Save</button>';
    expect(findStepTarget(click('aria/Save[role="button"]'), document)).toBe(
      byId("shown"),
    );
  });

  it("is undefined when nothing matches", () => {
    document.body.innerHTML = "<p>Nothing here</p>";
    expect(
      findStepTarget(
        click("#missing", "aria/Billing", "text/Billing"),
        document,
      ),
    ).toBeUndefined();
  });

  it("survives an invalid CSS selector", () => {
    document.body.innerHTML = '<button id="ok">Ok</button>';
    expect(findStepTarget(click("[[", "text/Ok"), document)).toBe(byId("ok"));
  });

  it("is undefined for a navigate step", () => {
    expect(
      findStepTarget({ type: "navigate", url: "https://a.test/" }, document),
    ).toBeUndefined();
  });
});
