import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { authorized } from "../../test/api-token.js";

/**
 * ADR-0025: a comment carries the Chrome Recorder steps that led to it. The
 * server stores them as sent, refuses input values, and caps their size.
 */

let BASE: string;

beforeEach(() => {
  BASE = `https://sync.test/workspaces/ws-${crypto.randomUUID()}`;
});

const put = (body: unknown) =>
  SELF.fetch(`${BASE}/comments/c-1`, {
    method: "PUT",
    headers: authorized({ "content-type": "application/json" }),
    body: JSON.stringify(body),
  });

const listComments = async (): Promise<unknown> =>
  (await SELF.fetch(`${BASE}/comments`, { headers: authorized() })).json();

const comment = (steps: unknown) => ({
  id: "c-1",
  groupId: "g-1",
  content: "<div>x</div>",
  elementName: "Card",
  tagName: "div",
  timestamp: 1,
  steps,
});

const flow = [
  { type: "navigate", url: "https://app.example.com/settings" },
  {
    type: "click",
    selectors: ['aria/Billing[role="tab"]', "#billing-tab", "text/Billing"],
    offsetX: 12,
    offsetY: 8,
    assertedEvents: [
      { type: "navigation", url: "https://app.example.com/settings/billing" },
    ],
  },
  { type: "change", selectors: ['aria/Coupon[role="textbox"]'], value: "" },
];

describe("comment steps", () => {
  it("stores the steps and returns them unchanged", async () => {
    expect((await put(comment(flow))).status).toBe(200);
    expect(await listComments()).toEqual([
      expect.objectContaining({ id: "c-1", steps: flow }),
    ]);
  });

  it("clears the steps when a later write leaves them out", async () => {
    await put(comment(flow));
    await put(comment(undefined));
    expect(await listComments()).toEqual([
      expect.not.objectContaining({ steps: expect.anything() }),
    ]);
  });

  it("refuses an input value", async () => {
    const withValue = [
      { type: "change", selectors: ["#password"], value: "hunter2" },
    ];
    expect((await put(comment(withValue))).status).toBe(400);
  });

  it("refuses more steps than the cap", async () => {
    const tooMany = Array.from({ length: 52 }, () => ({
      type: "navigate",
      url: "https://app.example.com/",
    }));
    expect((await put(comment(tooMany))).status).toBe(400);
  });

  it("refuses a step type it does not know", async () => {
    const unknownType = [{ type: "keyDown", key: "Enter" }];
    expect((await put(comment(unknownType))).status).toBe(400);
  });

  it("refuses an overlong selector", async () => {
    const longSelector = [
      {
        type: "click",
        selectors: ["x".repeat(513)],
        offsetX: 0,
        offsetY: 0,
      },
    ];
    expect((await put(comment(longSelector))).status).toBe(400);
  });
});
