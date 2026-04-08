// packages/react-grab/src/core/plugins/recorder/format-text.test.ts
import { describe, it, expect } from "vitest";
import { toHumanText } from "./format-text.js";
import type { CapturedStep } from "./types.js";
import type { ResolveComponentInfo } from "./component-info.js";

const stub: ResolveComponentInfo = async () => ({
  component: "LoginForm",
  file: "components/login-form.tsx:46",
});
const nullResolver: ResolveComponentInfo = async () => ({
  component: null,
  file: null,
});

const click = (sel = "button#go"): CapturedStep => ({
  id: "id",
  timestamp: 0,
  element: document.createElement("button"),
  selector: sel,
  kind: { type: "click", offsetX: 0, offsetY: 0 },
});

const change = (sel: string, value: string): CapturedStep => ({
  id: "id",
  timestamp: 0,
  element: document.createElement("input"),
  selector: sel,
  kind: { type: "change", value },
});

describe("toHumanText", () => {
  it("returns sentinel when input is empty", async () => {
    expect(await toHumanText([], stub)).toBe("(no recorded steps)");
  });

  it("numbers steps starting from 1", async () => {
    const text = await toHumanText([click(), click()], stub);
    expect(text.split("\n")[0]).toMatch(/^1\. /);
    expect(text.split("\n")[1]).toMatch(/^2\. /);
  });

  it("includes ' in <Component> at <file:line>' annotation when info is available", async () => {
    const text = await toHumanText([click("button#go")], stub);
    expect(text).toMatch(/Click button#go in LoginForm at components\/login-form\.tsx:46/);
  });

  it("omits annotation when component info is null", async () => {
    const text = await toHumanText([click("button#go")], nullResolver);
    expect(text).toBe("1. Click button#go");
  });

  it("describes change steps with the typed value", async () => {
    const text = await toHumanText([change("input#email", "doruk@example.com")], nullResolver);
    expect(text).toMatch(/Type "doruk@example\.com" into input#email/);
  });
});
